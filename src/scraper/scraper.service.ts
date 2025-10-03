import * as cheerio from 'cheerio';
import puppeteer, { Browser } from 'puppeteer';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ScrapedData, TeamMember } from './schemas/scraped-data.schema';

@Injectable()
export class ScraperService {
  constructor(
    @InjectModel(ScrapedData.name) private scrapedDataModel: Model<ScrapedData>,
  ) {}

  // -------------------------
  // Utility Extractors
  // -------------------------

  private extractAllText($: cheerio.CheerioAPI): string[] {
    return $('h1,h2,h3,h4,h5,h6,p,span,div,li,blockquote')
      .map((_, el) => $(el).text().trim().replace(/\s+/g, ' '))
      .get()
      .filter((t) => t.length > 2);
  }

  private extractEmail($: cheerio.CheerioAPI): string {
    return (
      $("a[href^='mailto:']").first().attr('href')?.replace('mailto:', '') ||
      $('body')
        .text()
        .match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/)?.[0] ||
      ''
    );
  }

  private extractPhone($: cheerio.CheerioAPI): string {
    const rawPhone =
      $("a[href^='tel:']").first().attr('href')?.replace('tel:', '') ||
      $('body')
        .text()
        .match(/(\+?\d[\d\s().-]{7,})/)?.[0] ||
      '';

    // Remove spaces, parentheses, and dashes
    return rawPhone.replace(/[\s().-]+/g, '');
  }

  private extractAbout($: cheerio.CheerioAPI): string {
    // Try meta
    let about =
      $("meta[name='description']").attr('content') ||
      $("meta[property='og:description']").attr('content') ||
      '';

    if (!about) {
      // Class/id "about"
      about = $("[id*='about'],[class*='about']")
        .find('p,div,span')
        .not('a,nav,header,footer,li,ul')
        .map((_, el) => $(el).text().trim())
        .get()
        .filter((t) => t.length > 20)
        .join(' ')
        .replace(/\s+/g, ' ');
    }

    if (!about) {
      // Paragraph with "about"
      $('p').each((_, el) => {
        const text = $(el).text().trim();
        if (/about/i.test(text) && text.length > 20) {
          about = text;
          return false;
        }
      });
    }

    return about || '';
  }

  private extractLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
    const links: string[] = [];
    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (
        href &&
        !href.startsWith('#') &&
        !href.toLowerCase().startsWith('javascript')
      ) {
        try {
          const absUrl = new URL(href, baseUrl).toString();
          if (!links.includes(absUrl)) links.push(absUrl);
        } catch {}
      }
    });
    return links;
  }

  // -------------------------
  // Main Scraper
  // -------------------------

  async scrapeWebsite(url: string, userId: string, category: string) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const html = await page.content();
    const $ = cheerio.load(html);

    const data: Partial<ScrapedData> = {
      url,
      name:
        $("meta[property='og:site_name']").attr('content') ||
        $('title').text().trim() ||
        $('h1').first().text().trim() ||
        'Unknown',
      email: this.extractEmail($),
      phone: this.extractPhone($),
      about: this.extractAbout($),
      links: this.extractLinks($, url),
      socialLinks: [],
      headlines: $('h1,h2,h3')
        .map((_, el) => $(el).text().trim())
        .get(),
      slogan:
        $("meta[name='description']").attr('content') ||
        $("meta[property='og:description']").attr('content') ||
        $('.slogan,.tagline,.subtitle,.hero-text').first().text().trim() ||
        '',
      userId,
      category,
      team: [],
      pages: [{ url, texts: this.extractAllText($) }],
    };

    // -------------------------
    // Scrape child pages with concurrency limit
    // -------------------------
    const filteredLinks =
      data?.links?.filter(
        (l) =>
          !/mailto:|tel:|linkedin|instagram|facebook|twitter|youtube|github|upwork|fiverr|freelancer|drive/i.test(
            l,
          ),
      ) ?? [];

    const limit = 3; // scrape 3 pages in parallel
    for (let i = 0; i < filteredLinks.length; i += limit) {
      const batch = filteredLinks.slice(i, i + limit);

      await Promise.allSettled(
        batch?.map(async (link) => {
          try {
            const subPage = await browser.newPage();
            await subPage.goto(link, {
              waitUntil: 'domcontentloaded',
              timeout: 60000,
            });
            const subHtml = await subPage.content();
            const $sub = cheerio.load(subHtml);

            data?.pages?.push({ url: link, texts: this.extractAllText($sub) });

            await subPage.close();
          } catch (err) {
            console.log(`❌ Failed to scrape ${link}:`, err.message);
          }
        }),
      );
    }

    // -------------------------
    // Try About / Contact fallback
    // -------------------------
    if (!data?.about) {
      const aboutLink = data?.links?.find((l) => l.includes('about'));
      if (aboutLink) {
        try {
          const subPage = await browser.newPage();
          await subPage.goto(aboutLink, { waitUntil: 'domcontentloaded' });
          const aboutHtml = await subPage.content();
          data.about = this.extractAbout(cheerio.load(aboutHtml));
          await subPage.close();
        } catch {}
      }
    }

    if (!data?.email || !data?.phone) {
      const contactLink = data?.links?.find((l) => l.includes('contact'));
      if (contactLink) {
        try {
          const subPage = await browser.newPage();
          await subPage.goto(contactLink, { waitUntil: 'domcontentloaded' });
          const $contact = cheerio.load(await subPage.content());
          data.email = data.email || this.extractEmail($contact);
          data.phone = data.phone || this.extractPhone($contact);
          await subPage.close();
        } catch {}
      }
    }

    // -------------------------
    // Team Members (optional)
    // -------------------------
    const aboutPageLink = data?.links?.find((l) =>
      l.toLowerCase().includes('about'),
    );
    if (aboutPageLink) {
      try {
        const subPage = await browser.newPage();
        await subPage.goto(aboutPageLink, { waitUntil: 'domcontentloaded' });
        const $about = cheerio.load(await subPage.content());

        const teamMembers: TeamMember[] = [];
        $about("[class*='container']").each((_, el) => {
          const block = $about(el);
          const name = block.find('h2,h3,h4,.name,strong,b').text().trim();
          const role = block.find('p,span,div').text().trim();
          const email = this.extractEmail(block as any);
          const phone = this.extractPhone(block as any);

          if (name || role || email || phone) {
            teamMembers.push({ name, role, email, phone });
          }
        });

        data.team = teamMembers;
        await subPage.close();
      } catch {}
    }

    // -------------------------
    // Save to DB
    // -------------------------
    const scraped = new this.scrapedDataModel(data);
    await scraped.save();
    console.log('Scraped data saved to DB:');

    await browser.close();
    return data;
  }

  async scrapeAll(userId: string) {
    return this.scrapedDataModel.find({ userId });
  }
}

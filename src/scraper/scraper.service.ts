import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ScrapedData, TeamMember } from './schemas/scraped-data.schema';

@Injectable()
export class ScraperService {
  constructor(
    @InjectModel(ScrapedData.name) private scrapedDataModel: Model<ScrapedData>,
  ) {}

  async scrapeWebsite(url: string, userId: string, category: string) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const html = await page.content();
    const $ = cheerio.load(html);

    const data: Partial<ScrapedData> = {
      url,
      name: $('title').first().text().trim() || 'Unknown',
      email:
        $("a[href^='mailto:']").first().attr('href')?.replace('mailto:', '') ||
        '',
      phone:
        $("a[href^='tel:']").first().attr('href')?.replace('tel:', '') || '',
      links: [] as string[],
      socialLinks: [] as string[],
      about: '',
      headlines: [] as string[],
      slogan: '',
      userId,
      category,
      team: [] as TeamMember[],
      pages: [] as { url: string; texts: string[] }[],
    };

    // ---- NAME ----
    data.name =
      $("meta[property='og:site_name']").attr('content') ||
      $('title').text().trim() ||
      $('h1').first().text().trim();

    // ---- EMAIL ----
    let email =
      $("a[href^='mailto:']").first().attr('href')?.replace('mailto:', '') ||
      $('body')
        .text()
        .match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/)?.[0];
    data.email = email || '';

    // ---- PHONE ----
    let phone =
      $("a[href^='tel:']").first().attr('href')?.replace('tel:', '') ||
      $('body')
        .text()
        .match(/(\+?\d[\d\s().-]{7,})/)?.[0];
    data.phone = phone || '';

    // ---- SOCIAL LINKS ----
    const socials = ['facebook', 'twitter', 'linkedin', 'instagram', 'youtube'];
    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (href && socials.some((s) => href.toLowerCase().includes(s))) {
        data?.socialLinks?.push(new URL(href, url).toString());
      }
    });

    // all links
    // ---- ALL LINKS ----
    let allLinks: string[] = [];
    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (
        href &&
        !href.startsWith('#') &&
        !href.toLowerCase().startsWith('javascript')
      ) {
        try {
          const absUrl = new URL(href, url).toString();
          if (!allLinks.includes(absUrl)) {
            allLinks.push(absUrl);
          }
        } catch {}
      }
    });
    data['links'] = allLinks;

    // ✅ Extract text from a page
    const extractAllText = ($: cheerio.CheerioAPI): string[] => {
      return $('h1, h2, h3, h4, h5, h6, p, span, div, li, blockquote')
        .map((_, el) => $(el).text().trim().replace(/\s+/g, ' '))
        .get()
        .filter((t) => t.length > 2);
    };

    // ✅ Scrape **main page**
    data?.pages?.push({ url: url, texts: extractAllText($) });

    // ✅ Loop all links and categorize
    for (const link of allLinks) {
      try {
        console.log('Scraping link:', link);
        await page.goto(link, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
        const subHtml = await page.content();
        const $sub = cheerio.load(subHtml);

        const texts = extractAllText($sub);

        // Save each page individually
        data?.pages?.push({
          url: link,
          texts,
        });
      } catch (err) {
        console.log(`❌ Failed to scrape ${link}:`, err.message);
      }
    }

    // ---- HEADLINES ----
    $('h1, h2, h3').each((_, el) => {
      const text = $(el).text().trim();
      if (text) data?.headlines?.push(text);
    });

    // ---- SLOGAN ----
    let slogan =
      $("meta[name='description']").attr('content') ||
      $("meta[property='og:description']").attr('content') ||
      $('.slogan, .tagline, .subtitle, .hero-text').first().text().trim();

    if (!slogan) {
      // try first h2/h3 after h1
      const firstH1 = $('h1').first();
      const next = firstH1.next('h2, h3');
      if (next.length) slogan = next.text().trim();
    }

    data.slogan = slogan || '';

    // ---- ABOUT ----
    let aboutText = '';

    // 1. Try meta description first
    aboutText = $("meta[name='description']").attr('content') || '';

    // 2. Try elements with id/class containing "about"
    if (!aboutText) {
      aboutText = $("[id*='about'], [class*='about']")
        .find('p, div, span') // only text containers
        .not('a, nav, header, footer, li, ul') // skip menus
        .map((_, el) => $(el).text().trim())
        .get()
        .filter((t) => t.length > 20) // ignore short junk ("Home", "Menu")
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    // 3. Fallback: look for any <p> that contains "about"
    if (!aboutText) {
      $('p').each((_, el) => {
        const text = $(el).text().trim();
        if (/about/i.test(text) && text.length > 20) {
          aboutText = text;
          return false; // break loop
        }
      });
    }

    data.about = aboutText || '';

    // ---- FALLBACK TO OTHER PAGES ----
    if (!data.about || !data.phone || !data.email) {
      let links: string[] = [];
      $('a').each((_, el) => {
        const href = $(el).attr('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript')) {
          links.push(new URL(href, url).toString());
        }
      });

      // ✅ Try About page only if about is missing
      if (!data.about) {
        let aboutLink = (data['links'] ?? []).find((l) => l?.includes('about'));
        console.log('about link', aboutLink);
        if (aboutLink) {
          await page.goto(aboutLink, { waitUntil: 'domcontentloaded' });
          const aboutHtml = await page.content();
          const $about = cheerio.load(aboutHtml);

          let aboutText = '';

          aboutText = $about("[id*='about'], [class*='about']")
            .find('p, div, span') // only text containers
            .not('a, nav, header, footer, li, ul') // exclude menus and lists
            .map((_, el) => $about(el).text().trim())
            .get()
            .filter((t) => t.length > 20) // ignore very short menu-like text
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

          // Fallback if empty
          if (!aboutText) {
            aboutText = $about('p')
              .map((_, el) => $about(el).text().trim())
              .get()
              .filter((t) => t.length > 20)
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim();
          }

          data.about = aboutText;
        }
      }

      // ✅ Try Contact page if phone/email missing
      if (!data.phone || !data.email) {
        let contactLink = (data['links'] ?? []).find((l) =>
          l?.includes('contact'),
        );
        console.log('contact link', contactLink);
        if (contactLink) {
          await page.goto(contactLink, { waitUntil: 'domcontentloaded' });
          const contactHtml = await page.content();
          const $contact = cheerio.load(contactHtml);

          if (!data.phone) {
            data.phone =
              $contact("a[href^='tel:']")
                .first()
                .attr('href')
                ?.replace('tel:', '') ||
              $contact('body')
                .text()
                .match(/(\+?\d[\d\s().-]{7,})/)?.[0] ||
              '';
          }

          if (!data.email) {
            data.email =
              $contact("a[href^='mailto:']")
                .first()
                .attr('href')
                ?.replace('mailto:', '') ||
              $contact('body')
                .text()
                .match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/)?.[0] ||
              '';
          }
        }
      }
    }

    // ---- TEAM MEMBERS ----
    let teamMembers: {
      name?: string;
      role?: string;
      email?: string;
      phone?: string;
      address?: string;
      socialLinks?: {
        facebook?: string[];
        instagram?: string[];
        linkedin?: string[];
        other?: string[];
      };
    }[] = [];

    // Find the about page link
    const aboutPageLink = (data['links'] ?? []).find((l) =>
      l?.toLowerCase().includes('about'),
    );
    if (!aboutPageLink) {
      console.log('No about page found');
      await browser.close();
      return;
    }

    console.log('About page link:', aboutPageLink);
    await page.goto(aboutPageLink, { waitUntil: 'domcontentloaded' });

    const aboutHtml = await page.content();
    const $about = cheerio.load(aboutHtml);

    // Search for team/member blocks
    $about("[class*='container']").each((_, el) => {
      const block = $about(el);

      const name = block.find('h2, h3, h4, .name, strong, b').text() || '';
      const role = block.find('p, span, div').text() || '';
      // const name =
      //   block
      //     .find('h2, h3, h4, .name, strong, b')
      //     .text()
      //     .trim()
      //     .replace(/\s+/g, ' ') || '';

      // const role =
      //   block
      //     .find('p, span, div')
      //     .filter((_, el) =>
      //       /role|position|title/i.test($about(el).attr('class') || ''),
      //     )
      //     .text()
      //     .trim() || '';

      const email =
        block.find("a[href^='mailto:']").attr('href')?.replace('mailto:', '') ||
        block
          .text()
          .match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/)?.[0] ||
        '';

      let phone =
        block.find("a[href^='tel:']").attr('href')?.replace('tel:', '') ||
        block.text().match(/(\+?\d[\d\s().-]{7,})/)?.[0] ||
        '';
      phone = phone.replace(/[\s().-]/g, '');

      let address =
        block
          .find("[class*='address'], [id*='address'], address")
          .text()
          .trim() || '';
      if (!address) {
        const match = block
          .text()
          .match(/(?:address|location|street)[\s:]*([A-Za-z0-9\s,.-]{15,})/i);
        if (match) address = match[1].trim();
      }

      // const socialLinks = {
      //   facebook: block.find("a[href*='facebook.com']").attr('href') || '',
      //   instagram: block.find("a[href*='instagram.com']").attr('href') || '',
      //   linkedin: block.find("a[href*='linkedin.com']").attr('href') || '',
      // };

      // Collect **all social links**
      const socialLinks = {
        facebook: block
          .find("a[href*='facebook.com']")
          .map((_, a) => $about(a).attr('href'))
          .get(),
        instagram: block
          .find("a[href*='instagram.com']")
          .map((_, a) => $about(a).attr('href'))
          .get(),
        linkedin: block
          .find("a[href*='linkedin.com']")
          .map((_, a) => $about(a).attr('href'))
          .get(),
        other: block
          .find('a[href]')
          .map((_, a) => $about(a).attr('href'))
          .get()
          .filter(
            (href) =>
              href &&
              !/facebook\.com|instagram\.com|linkedin\.com|mailto:|tel:/i.test(
                href,
              ),
          ),
      };

      teamMembers.push({
        name,
        role,
        email,
        phone,
        address,
        socialLinks,
      });
    });

    // Assign to schema field
    data['team'] = teamMembers;

    // ✅ Store in DB
    const scraped = new this.scrapedDataModel(data);
    await scraped.save();

    await browser.close();
    return data;
  }

  async scrapeAll(userId: string) {
    const websites = await this.scrapedDataModel.find({ userId });
    if (!websites) return { error: 'No websites found' };
    return websites;
  }
}

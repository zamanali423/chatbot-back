import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ScrapedData } from './schemas/scraped-data.schema';

@Injectable()
export class ScraperService {
  constructor(
    @InjectModel(ScrapedData.name) private scrapedDataModel: Model<ScrapedData>,
  ) {}

  async scrapeWebsite(url: string, userId: string) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const html = await page.content();
    const $ = cheerio.load(html);

    // Patterns
    const aboutPatterns = /(about|about_us|about-us|our-story|who-we-are)/i;
    const contactPatterns =
      /(contact|contact_us|contact-us|contacts|get-in-touch)/i;

    const data: Partial<ScrapedData> = {
      url,
      name: $('title').first().text().trim() || 'Unknown',
      email:
        $("a[href^='mailto:']").first().attr('href')?.replace('mailto:', '') ||
        '',
      phone:
        $("a[href^='tel:']").first().attr('href')?.replace('tel:', '') || '',
      socialLinks: [] as string[],
      about: '',
      headlines: [] as string[],
      slogan: '',
      userId,
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

    // Try meta description first
    aboutText = $("meta[name='description']").attr('content') || '';

    // Try elements with id/class containing about
    if (!aboutText) {
      aboutText =
        $("[id*='about'], [class*='about']").text().trim() ||
        $("section:contains('About')").text().trim();
    }

    // Fallback: try paragraph text if includes 'about'
    if (!aboutText) {
      $('p').each((_, el) => {
        const text = $(el).text();
        if (/about/i.test(text)) {
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
        let aboutLink = (links ?? []).find((l) => aboutPatterns.test(l));
        if (aboutLink) {
          await page.goto(aboutLink, { waitUntil: 'domcontentloaded' });
          const aboutHtml = await page.content();
          const $about = cheerio.load(aboutHtml);

          data.about =
            $about("[id*='about'], [class*='about']").text().trim() ||
            $about('p').first().text().trim() ||
            '';
        }
      }

      // ✅ Try Contact page if phone/email missing
      if (!data.phone || !data.email) {
        let contactLink = (links ?? []).find((l) => contactPatterns.test(l));
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

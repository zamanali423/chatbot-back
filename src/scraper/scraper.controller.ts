import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('scraper')
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async scrape(
    @Req() req: any,
    @Query('url') url: string,
    @Query('category') category: string,
  ) {
    if (!url || !category) {
      return {
        error: 'Please provide a valid ?url= parameter or category=parameter',
      };
    }
    console.log('Scraping URL:', url, category);
    return this.scraperService.scrapeWebsite(url, req?.user?.id, category);
  }

  // @UseGuards(AuthGuard('jwt'))
  // @Get('update')
  // async updateScrapedData(
  //   @Req() req: any,
  //   @Query('websiteId') websiteId: string,
  // ) {
  //   return this.scraperService.updateScrapedData(websiteId);
  // }

  @UseGuards(AuthGuard('jwt'))
  @Get('scrape-all')
  async scrapeAll(@Req() req: any) {
    console.log('Authenticated user:', req?.user); // { userId, email }
    return this.scraperService.scrapeAll(req?.user?.id);
  }
}

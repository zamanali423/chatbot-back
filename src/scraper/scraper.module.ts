import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScraperService } from './scraper.service';
import { ScraperController } from './scraper.controller';
import { ScrapedData, ScrapedDataSchema } from './schemas/scraped-data.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ScrapedData.name, schema: ScrapedDataSchema },
    ]),
  ],
  controllers: [ScraperController],
  providers: [ScraperService],
})
export class ScraperModule {}

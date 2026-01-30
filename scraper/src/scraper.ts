import axios from 'axios';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface ScrapedData {
  title: string;
  content: string;
  url: string;
}

async function scrapeWebsite(url: string): Promise<ScrapedData> {
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);

  // Customize these selectors for your target website
  const title = $('h1').first().text().trim();
  const content = $('body').text().trim();

  return {
    title,
    content,
    url,
  };
}

async function saveToDatabase(data: ScrapedData) {
  await prisma.scrapedContent.create({
    data: {
      title: data.title,
      content: data.content,
      url: data.url,
    },
  });
  console.log('Data saved successfully');
}

async function main() {
  try {
    const targetUrl = process.env.TARGET_URL || 'https://example.com';
    console.log(`Scraping: ${targetUrl}`);

    const scrapedData = await scrapeWebsite(targetUrl);
    await saveToDatabase(scrapedData);

    console.log('Scraping completed successfully');
  } catch (error) {
    console.error('Error during scraping:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();

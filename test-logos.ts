import * as fs from 'fs';
import { fetchProfileHtml } from './src/server/services/scraper.service';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const liAt = process.env.LINKEDIN_LI_AT;
    const jsessionid = process.env.LINKEDIN_JSESSIONID;
    
    console.log("Fetching HTML for Sundar Pichai...");
    const htmlRes = await fetchProfileHtml('https://www.linkedin.com/in/sundarpichai/', liAt, jsessionid, 'Mozilla/5.0');
    if (!htmlRes.success) {
        console.log("Failed to fetch HTML");
        return;
    }
    const html = htmlRes.html!;
    
    // Look for all image URLs in RSC
    const rscImages = [...new Set([...html.matchAll(/https:\/\/media\.licdn\.com\/dms\/image\/[^"'\\]+/g)].map(m => m[0]))];
    
    console.log("All media images found:");
    rscImages.forEach(img => {
        if (img.includes('company-logo') || img.includes('logo')) {
            console.log(" - LOGO CANDIDATE:", img);
        } else {
            console.log(" -", img.substring(0, 80));
        }
    });
}
run();

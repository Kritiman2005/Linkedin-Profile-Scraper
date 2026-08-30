import { fetchProfileHtml } from './src/server/services/scraper.service';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config({ path: '.env.local' });

async function run() {
    const liAt = process.env.LINKEDIN_LI_AT;
    const jsessionid = process.env.LINKEDIN_JSESSIONID;
    
    console.log("Fetching HTML for Satya Nadella...");
    const htmlRes = await fetchProfileHtml('https://www.linkedin.com/in/satyanadella/', liAt, jsessionid, 'Mozilla/5.0');
    if (!htmlRes.success) {
        console.log("Failed to fetch HTML");
        return;
    const matchArr = html.match(/window\.__como_rehydration__\s*=\s*(\[.*?\])\s*</s);
    if (!matchArr) return;
    const arr = new Function('return ' + matchArr[1])();
    const fullText = arr.join('');
    
    const regex = /"rootUrl":"([^"]+company-logo_)","imageRenditions":\[.*?suffixUrl":"([^"]+)"/g;
    
    let match;
    while ((match = regex.exec(fullText)) !== null) {
        console.log(" - FULL LOGO URL:", match[1] + match[2]);
    }
}
run();

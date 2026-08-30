import { fetchProfileHtml } from './src/server/services/scraper.service';
import { extractFromComo, parseComoRehydration } from './src/server/lib/como-parser';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const liAt = process.env.LINKEDIN_LI_AT;
    const jsessionid = process.env.LINKEDIN_JSESSIONID;
    
    console.log("Fetching HTML for fardin-aziz-b22279333...");
    const htmlRes = await fetchProfileHtml('https://www.linkedin.com/in/fardin-aziz-b22279333/', liAt!, jsessionid!, 'Mozilla/5.0');
    if (!htmlRes.success) {
        console.log("Failed to fetch HTML");
        return;
    }
    const html = htmlRes.html!;
    
    // We can extract directly
    const rscData = extractFromComo(html, 'https://www.linkedin.com/in/fardin-aziz-b22279333/');
    console.log("RSC Extracted Data:");
    console.log(JSON.stringify(rscData, null, 2));
    
    const arr = parseComoRehydration(html);
    const fullText = arr.join('');
    const textNodes = [...fullText.matchAll(/"children":\["([^"]+)"\]/g)].map(m => m[1]);
    const cleanNodes = textNodes.filter(t => 
        t.length > 2 && 
        !t.includes('$') && 
        !t.includes('http') && 
        !t.includes('www.') && 
        !t.includes('LinkedIn') &&
        t !== 'Experience' && 
        t !== 'Education' &&
        t !== 'Show all' &&
        !t.includes('View ') &&
        !t.includes('followers') &&
        !t.includes('connections')
    );
    
    const contactInfoIndex = cleanNodes.findIndex(n => n === 'Contact info');
    console.log("\nNodes near Contact info:");
    for (let i = Math.max(0, contactInfoIndex - 5); i <= contactInfoIndex; i++) {
        console.log(`[${i}] ${cleanNodes[i]}`);
    }

    const lovelyIndex = cleanNodes.findIndex(n => n.includes('Lovely'));
    console.log(`\n'Lovely' is at index ${lovelyIndex}`);
}
run();

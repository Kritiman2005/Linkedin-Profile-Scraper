import { ProfileData } from '../models/profile.model'

export function parseComoRehydration(html: string): any[] {
    const regex = /window\.__como_rehydration__\s*=\s*(\[.*?\])\s*</s;
    const match = html.match(regex);
    if (!match) return [];
    try {
        return new Function('return ' + match[1])();
    } catch (e) {
        return [];
    }
}
export function extractFromComo(html: string, profileUrl: string): Partial<ProfileData> | null {
    const regex = /window\.__como_rehydration__\s*=\s*(\[.*?\])\s*</s;
    const match = html.match(regex);
    
    if (!match) return null;

    let arr = [];
    try {
        // The array often contains unescaped characters that break JSON.parse
        // Safely evaluate the array definition
        arr = new Function('return ' + match[1])();
    } catch (e) {
        console.error("Failed to parse RSC array", e);
        return null;
    }
    
    const fullText = arr.join('');
    
    // Extract all text nodes from the RSC string literals
    const textNodes = [...fullText.matchAll(/"children":\["([^"]+)"\]/g)].map(m => m[1]);
    
    // Clean up noise and functional UI text
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

    let name = '';
    let headline = '';
    let location = '';
    let currentCompany = '';
    let currentEducation = '';

    // Fallback: extract name from title tag in HTML
    const titleMatch = html.match(/<title>(.*?)\| LinkedIn<\/title>/);
    if (titleMatch) {
        name = titleMatch[1].trim();
    }

    // Heuristic parsing for Top Card data
    // The Top Card reliably contains "Contact info". 
    // The nodes immediately preceding it are typically: [Company/Education, Location, "Contact info"]
    const contactInfoIndex = cleanNodes.findIndex(n => n === 'Contact info');
    
    if (contactInfoIndex >= 2) {
        location = cleanNodes[contactInfoIndex - 1];
        const companyEduNode = cleanNodes[contactInfoIndex - 2];
        
        // If the node contains a middle dot '·', it has both Company and Education
        if (companyEduNode.includes('·')) {
            const parts = companyEduNode.split('·').map((p: string) => p.trim());
            currentCompany = parts[0] || '';
            currentEducation = parts[1] || '';
        } else {
            // Otherwise it's usually just the company
            currentCompany = companyEduNode;
        }
    }

    // Fallback: If we couldn't parse company from the anchor, try the headline
    if (!currentCompany && name) {
        const nameIndex = cleanNodes.findIndex(n => n.includes(name));
        if (nameIndex !== -1 && nameIndex + 1 < cleanNodes.length) {
            headline = cleanNodes[nameIndex + 1];
            if (headline.includes(' at ')) {
                currentCompany = headline.split(' at ').pop() || '';
            }
        }
    } else if (name) {
        const nameIndex = cleanNodes.findIndex(n => n.includes(name));
        if (nameIndex !== -1 && nameIndex + 1 < cleanNodes.length) {
            headline = cleanNodes[nameIndex + 1];
        }
    }

    // Education is often isolated further down if it wasn't in the anchor node
    if (!currentEducation) {
        const possibleEdu = cleanNodes.find(n => n !== currentCompany && (n.includes('University') || n.includes('College') || n.includes('School') || n.includes('Institute')));
        if (possibleEdu) {
            currentEducation = possibleEdu;
        }
    }

    if (!name) return null;

    const experience = currentCompany ? [{ title: headline, company: currentCompany, duration: '', description: 'Extracted from Top Card' }] : [];
    const education = currentEducation ? [{ school: currentEducation, degree: '', field: '', years: '' }] : [];

    let profileImageUrl: string | null = null;
    const ogImageMatch = html.match(/<meta\s+(?:property|name)="og:image"\s+content="([^"\s]+)"/i);
    if (ogImageMatch && ogImageMatch[1] && !ogImageMatch[1].includes('ghost')) {
        profileImageUrl = ogImageMatch[1].replace(/&amp;/g, '&');
    } else {
        const profilePhotoMatch = html.match(/https:\/\/media\.licdn\.com\/dms\/image\/[^"'\\\s]+profile-displayphoto-[^"'\\\s]+/i);
        if (profilePhotoMatch) {
            profileImageUrl = profilePhotoMatch[0].replace(/&amp;/g, '&');
        } else {
            const anyMediaImage = html.match(/https:\/\/media\.licdn\.com\/dms\/image\/[^"'\\\s]+/i);
            if (anyMediaImage && !anyMediaImage[0].includes('background')) {
                profileImageUrl = anyMediaImage[0].replace(/&amp;/g, '&');
            }
        }
    }

    return {
        profileUrl,
        name,
        headline,
        location,
        about: '',
        profileImageUrl,
        experience,
        education,
        skills: [],
        certifications: [],
        languages: []
    };
}

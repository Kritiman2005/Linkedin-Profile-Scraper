import * as fs from 'fs';

const html = fs.readFileSync('test_auth_html.html', 'utf-8');

// Find all URNs
const fsdMatches = [...html.matchAll(/urn:li:fsd_profile:([A-Za-z0-9_-]+)/g)];
const miniMatches = [...html.matchAll(/urn:li:fs_miniProfile:([A-Za-z0-9_-]+)/g)];

console.log('FSD Matches:');
const uniqueFsd = [...new Set(fsdMatches.map(m => m[1]))];
uniqueFsd.forEach(urn => console.log(' - ' + urn));

console.log('\nMini Matches:');
const uniqueMini = [...new Set(miniMatches.map(m => m[1]))];
uniqueMini.forEach(urn => console.log(' - ' + urn));


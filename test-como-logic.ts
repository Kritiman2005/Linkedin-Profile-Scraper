const html = "some text window.__como_rehydration__ = [1, 2, 3]; more text";
const prefix = 'window.__como_rehydration__ = [';
const startIndex = html.indexOf(prefix);
let braceCount = 1;
let inString = false;
let escapeNext = false;
let endIndex = -1;
for (let i = startIndex + prefix.length; i < html.length; i++) {
    const char = html[i];
    if (escapeNext) { escapeNext = false; continue; }
    if (char === '\\') { escapeNext = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (!inString) {
        if (char === '[') braceCount++;
        else if (char === ']') {
            braceCount--;
            if (braceCount === 0) { endIndex = i; break; }
        }
    }
}
const jsonStr = html.substring(startIndex + 'window.__como_rehydration__ = '.length - 1, endIndex + 1);
console.log("JSON String:", jsonStr);

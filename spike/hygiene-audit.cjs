const fs = require('fs');
const r = fs.readFileSync('README.md', 'utf8');
const emoji = r.match(/[\u2700-\u27BF\u{1F300}-\u{1FAFF}\u2600-\u26FF\u2B00-\u2BFF\uFE0F]/gu) || [];
console.log('emojis:', emoji.length, emoji.slice(0, 5));
const dashes = r.match(/[\u2014\u2013]/g) || [];
console.log('em/en dashes:', dashes.length);
const parts = r.split('```');
let colons = [];
for (let i = 0; i < parts.length; i += 2) {
    for (const m of parts[i].matchAll(/:/g)) {
        const lineStart = parts[i].lastIndexOf('\n', m.index - 1) + 1;
        const line = parts[i].slice(lineStart, m.index + 30).replace(/\n/g, ' | ');
        colons.push(line);
    }
}
console.log('colons in prose:', colons.length);
colons.forEach((c) => console.log('   ', c));

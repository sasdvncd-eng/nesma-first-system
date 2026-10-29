import fs from 'fs';

const content = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');
const lines = content.split('\n');

let inTemplate = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  let chars = line.split('');
  for (let j = 0; j < chars.length; j++) {
    const char = chars[j];
    if (char === '`') {
      if (j > 0 && chars[j-1] === '\\') {
        continue;
      }
      inTemplate = !inTemplate;
      console.log(`Line ${i + 1}: char ${j + 1} - backtick found. inTemplate = ${inTemplate}. Line text: ${line.trim()}`);
    }
  }
}

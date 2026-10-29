import fs from 'fs';
import path from 'path';

const transcriptPath = '/.gemini/antigravity/brain/616220b6-6c40-4af6-94c3-a3af3be5025f/.system_generated/logs/transcript.jsonl';

try {
  if (fs.existsSync(transcriptPath)) {
    console.log("Transcript exists!");
    const stat = fs.statSync(transcriptPath);
    console.log(`Size: ${(stat.size / (1024 * 1024)).toFixed(2)} MB`);
    
    // Let's read the first few lines and check what is inside.
    const fileContent = fs.readFileSync(transcriptPath, 'utf8');
    const lines = fileContent.split('\n');
    console.log(`Total lines: ${lines.length}`);
    
    // Search for occurrences of AdminDashboard.tsx content
    let foundIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('AdminDashboard.tsx') && lines[i].includes('export default function AdminDashboard')) {
        console.log(`Line ${i} matches AdminDashboard content search!`);
        foundIndex = i;
      }
    }
  } else {
    console.log("Transcript does NOT exist at path:", transcriptPath);
    // Let's also search in sibling directories of /.gemini
    const dir = '/.gemini';
    if (fs.existsSync(dir)) {
      console.log("/.gemini contents:", fs.readdirSync(dir));
    } else {
      console.log("/.gemini does not exist");
    }
  }
} catch (err) {
  console.log("Error reading transcript:", err.message);
}

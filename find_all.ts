import fs from 'fs';
import path from 'path';

function scanDir(dir: string, depth = 0) {
  if (depth > 4) return;
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file === 'node_modules' || file === '.next' || file === 'dist' || file === '.git') continue;
      const fullPath = path.join(dir, file);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        scanDir(fullPath, depth + 1);
      } else {
        if (file.includes('AdminDashboard') || file.endsWith('.zip') || file.endsWith('.tar.gz') || file.includes('backup')) {
          console.log(`Found: ${fullPath} (${(stat.size / 1024).toFixed(1)} KB)`);
        }
      }
    }
  } catch (err) {
    // ignore
  }
}

console.log("Scanning /app (CWD)...");
scanDir(process.cwd());

console.log("Scanning /tmp...");
scanDir('/tmp');

console.log("Scanning parent of CWD...");
scanDir(path.resolve(process.cwd(), '..'));

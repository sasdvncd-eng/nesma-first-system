import fs from 'fs';
import path from 'path';

function scanAll(dir: string, depth = 0) {
  if (depth > 6) return;
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (['node_modules', '.next', 'dist', '.git', 'proc', 'sys', 'dev', 'lib', 'lib64', 'bin', 'sbin', 'etc', 'usr', 'run', 'boot'].includes(file)) continue;
      const fullPath = path.join(dir, file);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        scanAll(fullPath, depth + 1);
      } else {
        if (file.includes('AdminDashboard') || file.endsWith('.zip') || file.endsWith('.tar.gz') || file.includes('backup') || file.includes('applet-')) {
          console.log(`Found: ${fullPath} (${(stat.size / 1024).toFixed(1)} KB)`);
        }
      }
    }
  } catch {
    // ignore
  }
}

console.log("Deep scanning filesystem from / ...");
scanAll('/');
console.log("Deep scan complete.");

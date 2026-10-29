import { execSync } from 'child_process';

const searchPatterns = [
  'find / -name "*AdminDashboard*" -not -path "*/node_modules/*" 2>/dev/null',
  'find . -name "*.bak" -o -name "*.tmp" -o -name "*.swp" 2>/dev/null',
];

for (const pattern of searchPatterns) {
  try {
    console.log(`=== Running find command: ${pattern} ===`);
    const result = execSync(pattern, { encoding: 'utf8' });
    console.log(result || "(no results)");
  } catch (err) {
    console.log(`Error running: ${pattern}`, err.message);
  }
}

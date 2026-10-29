import fs from 'fs';
import path from 'path';

function checkGit() {
  const gitDir = path.resolve('.git');
  if (fs.existsSync(gitDir)) {
    console.log(".git exists!");
    const logHead = path.join(gitDir, 'logs', 'HEAD');
    if (fs.existsSync(logHead)) {
      console.log("logs/HEAD exists!");
      const content = fs.readFileSync(logHead, 'utf8');
      const lines = content.trim().split('\n');
      console.log(`Log lines count: ${lines.length}`);
      console.log("Last 5 log lines:");
      console.log(lines.slice(-5).join('\n'));
    } else {
      console.log("logs/HEAD does not exist");
    }
  } else {
    console.log(".git does not exist");
  }
}

checkGit();

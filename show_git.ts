import { execSync } from 'child_process';

try {
  console.log("=== Git Status ===");
  try {
    const status = execSync('git status', { encoding: 'utf8' });
    console.log(status);
  } catch (err) {
    console.log("Git Status Error:", err.message);
  }

  console.log("=== Git Commits ===");
  try {
    const log = execSync('git log --oneline -n 10', { encoding: 'utf8' });
    console.log(log);
  } catch (err) {
    console.log("Git Log Error:", err.message);
  }
} catch (err) {
  console.log("General Error:", err.message);
}

import { execSync } from 'child_process';
try {
  const findRes = execSync('find / -name "*AdminDashboard*" -maxdepth 4 2>/dev/null', { encoding: 'utf8' });
  console.log("FIND MATCHES:\n", findRes);
} catch (err) {
  console.log("ERROR:\n", err.message);
}

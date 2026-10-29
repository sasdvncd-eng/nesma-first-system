import { execSync } from 'child_process';
try {
  const res = execSync('find / -name "*.zip" -o -name "*.tar.gz" -o -name "*.tgz" 2>/dev/null', { encoding: 'utf8' });
  console.log("ZIP/TAR FILES found:\n", res);
} catch (err) {
  console.log("ERR:\n", err.message);
}

import fs from 'fs';
try {
  console.log(fs.readFileSync('../start.sh', 'utf8'));
} catch (err) {
  console.log("ERROR:\n", err.message);
}

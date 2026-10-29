import fs from 'fs';
try {
  console.log("DASHBOARD STAT:", fs.statSync('src/components/AdminDashboard.tsx'));
  const rootFiles = fs.readdirSync('/');
  console.log("ROOT DIRECTORY OF CONTAINER MACHINE:\n", rootFiles);
} catch (err) {
  console.log("ERROR:\n", err.message);
}

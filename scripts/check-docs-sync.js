import fs from 'fs';
import path from 'path';

const files = [
  'README.es.md',
  'README.fr.md',
  'README.pt.md',
  'README.de.md'
];

const sourceFile = 'README.md';

function checkSync() {
  const sourceStats = fs.statSync(sourceFile);
  const sourceMtime = sourceStats.mtime;

  let outdated = false;
  files.forEach(file => {
    if (fs.existsSync(file)) {
      const stats = fs.statSync(file);
      if (stats.mtime < sourceMtime) {
        console.warn(`⚠️  Documentation synchronization: ${file} might be outdated compared to ${sourceFile}`);
        outdated = true;
      }
    } else {
      console.error(`❌ Missing translation file: ${file}`);
    }
  });

  if (!outdated) {
    console.log('✅ All translations are up to date with the source README.');
  }
}

checkSync();

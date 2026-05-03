import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      results.push(file);
    }
  });
  return results;
}

const files = walk('src').filter(f => f.endsWith('.js') || f.endsWith('.jsx'));
let hasError = false;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const imports = [...content.matchAll(/import\s+.*?from\s+['"](.*?)['"]/g)].map(m => m[1]);
  
  imports.forEach(imp => {
    if (imp.startsWith('.')) {
      const resolvedDir = path.dirname(file);
      const resolved = path.resolve(resolvedDir, imp);
      let found = false;
      const extensions = ['', '.js', '.jsx', '.css', '.png', '.svg'];
      
      for (const ext of extensions) {
        const p = resolved + ext;
        if (fs.existsSync(p)) {
          // Check true casing
          const real = fs.realpathSync.native(p);
          if (real !== p) {
            console.error(`CASE MISMATCH: imported "${imp}" in ${file} -> actual file is ${real}`);
            hasError = true;
          }
          found = true;
          break;
        }
      }
      
      if (!found) {
        console.error(`MISSING: imported "${imp}" in ${file}`);
        hasError = true;
      }
    }
  });
});

if (!hasError) console.log('All local imports resolve correctly with exact casing.');

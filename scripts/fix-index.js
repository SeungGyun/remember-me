const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../renderer-dist/index.html');

if (fs.existsSync(indexPath)) {
    let content = fs.readFileSync(indexPath, 'utf8');
    content = content.replace(/crossorigin/g, '');
    fs.writeFileSync(indexPath, content);
    console.log('Fixed index.html: Removed crossorigin attributes');
} else {
    console.error('renderer-dist/index.html not found');
}

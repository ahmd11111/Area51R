const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const categories = ['سيارات', 'عصابات', 'متاجر ومحلات', 'شخصيات'];

db.products = db.products.map((product, index) => {
  const categoryIndex = index % categories.length;
  return {
    ...product,
    category: categories[categoryIndex]
  };
});

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');

console.log(`Updated ${db.products.length} products with new categories:`);
categories.forEach(cat => {
  const count = db.products.filter(p => p.category === cat).length;
  console.log(`  ${cat}: ${count} products`);
});
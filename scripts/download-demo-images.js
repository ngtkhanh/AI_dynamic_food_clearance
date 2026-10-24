const fs = require('fs');
const path = require('path');
const https = require('https');

const IMAGES = [
  {
    name: 'BREAD-CROISSANT-01.jpg',
    url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&auto=format&fit=crop&q=80'
  },
  {
    name: 'BREAD-BAGUETTE-01.jpg',
    url: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=600&auto=format&fit=crop&q=80'
  },
  {
    name: 'BAKERY-DONUT-CHOCO-01.jpg',
    url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80'
  },
  {
    name: 'FRUIT-MIX-CUP-01.jpg',
    url: 'https://images.unsplash.com/photo-1519996529931-28324d5a630e?w=600&auto=format&fit=crop&q=80'
  },
  {
    name: 'SALAD-VEGGIE-EGG-01.jpg',
    url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&auto=format&fit=crop&q=80'
  },
  {
    name: 'DRINK-COLD-BREW-01.jpg',
    url: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=600&auto=format&fit=crop&q=80'
  }
];

const publicCatalogDir = path.join(process.cwd(), 'public', 'catalog');
const dataCatalogDir = path.join(process.cwd(), 'data', 'catalog', 'images');

if (!fs.existsSync(publicCatalogDir)) fs.mkdirSync(publicCatalogDir, { recursive: true });
if (!fs.existsSync(dataCatalogDir)) fs.mkdirSync(dataCatalogDir, { recursive: true });

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download ${url}: HTTP ${res.statusCode}`));
      }
      const fileStream = fs.createWriteStream(dest);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('🖼️ Đang tải ảnh demo chất lượng cao từ kho ảnh...');
  for (const item of IMAGES) {
    const publicDest = path.join(publicCatalogDir, item.name);
    const dataDest = path.join(dataCatalogDir, item.name);
    try {
      await downloadFile(item.url, publicDest);
      fs.copyFileSync(publicDest, dataDest);
      console.log(`✅ Đã tải: ${item.name}`);
    } catch (e) {
      console.error(`❌ Lỗi tải ${item.name}:`, e.message);
    }
  }
  console.log('🎉 Hoàn tất tải ảnh demo!');
}

main();

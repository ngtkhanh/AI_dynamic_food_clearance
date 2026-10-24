const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function importCatalog() {
  console.log('\n📦 ==============================================');
  console.log('   BẮT ĐẦU IMPORT MASTER CATALOG VÀO DATABASE');
  console.log('==============================================\n');

  const dataFilePath = path.join(process.cwd(), 'data', 'catalog', 'products.json');
  const srcImagesDir = path.join(process.cwd(), 'data', 'catalog', 'images');
  const destImagesDir = path.join(process.cwd(), 'public', 'catalog');

  if (!fs.existsSync(dataFilePath)) {
    console.error(`❌ Không tìm thấy file dữ liệu: ${dataFilePath}`);
    process.exit(1);
  }

  // Đảm bảo thư mục public/catalog tồn tại
  if (!fs.existsSync(destImagesDir)) {
    fs.mkdirSync(destImagesDir, { recursive: true });
    console.log(`📁 Đã tạo thư mục tĩnh: ${destImagesDir}`);
  }

  // Đọc danh mục
  const rawData = fs.readFileSync(dataFilePath, 'utf-8');
  let products;
  try {
    products = JSON.parse(rawData);
  } catch (err) {
    console.error(`❌ Lỗi định dạng JSON trong file ${dataFilePath}:`, err.message);
    process.exit(1);
  }

  if (!Array.isArray(products) || products.length === 0) {
    console.warn('⚠️ File products.json trống hoặc không phải là một danh sách hợp lệ.');
    process.exit(0);
  }

  console.log(`🔍 Tìm thấy ${products.length} sản phẩm cần import...\n`);

  // Đồng bộ ảnh nếu có
  if (fs.existsSync(srcImagesDir)) {
    const imageFiles = fs.readdirSync(srcImagesDir);
    let copiedCount = 0;
    for (const file of imageFiles) {
      if (file.toLowerCase().endsWith('.jpg') || file.toLowerCase().endsWith('.jpeg') || file.toLowerCase().endsWith('.png') || file.toLowerCase().endsWith('.webp')) {
        const srcPath = path.join(srcImagesDir, file);
        const destPath = path.join(destImagesDir, file);
        fs.copyFileSync(srcPath, destPath);
        copiedCount++;
      }
    }
    if (copiedCount > 0) {
      console.log(`🖼️  Đã đồng bộ ${copiedCount} ảnh mẫu sang public/catalog/\n`);
    }
  }

  let createdCount = 0;
  let updatedCount = 0;

  for (const item of products) {
    if (!item.name || typeof item.basePrice !== 'number' || typeof item.minPrice !== 'number') {
      console.warn(`⚠️ Bỏ qua sản phẩm không đủ thông tin bắt buộc: ${JSON.stringify(item)}`);
      continue;
    }

    const sku = item.sku || `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const sampleImagesJson = Array.isArray(item.sampleImages) ? JSON.stringify(item.sampleImages) : (item.sampleImages || '[]');

    // Kiểm tra xem sản phẩm đã có trong DB theo sku hoặc theo name chưa
    const existingProduct = await prisma.product.findFirst({
      where: {
        OR: [
          { sku: sku },
          { name: item.name }
        ]
      }
    });

    if (existingProduct) {
      await prisma.product.update({
        where: { id: existingProduct.id },
        data: {
          sku: sku,
          name: item.name,
          category: item.category || 'General',
          basePrice: item.basePrice,
          minPrice: item.minPrice,
          stockQuantity: item.stockQuantity !== undefined ? item.stockQuantity : 0,
          defaultShelfHours: item.defaultShelfHours || 24,
          sampleImages: sampleImagesJson,
          visualKeywords: item.visualKeywords || null
        }
      });
      console.log(`🔄 [Cập nhật] SKU: ${sku.padEnd(20)} | ${item.name} (${item.basePrice.toLocaleString('vi-VN')}đ | Tồn kho: ${item.stockQuantity || 0})`);
      updatedCount++;
    } else {
      await prisma.product.create({
        data: {
          sku: sku,
          name: item.name,
          category: item.category || 'General',
          basePrice: item.basePrice,
          minPrice: item.minPrice,
          stockQuantity: item.stockQuantity !== undefined ? item.stockQuantity : 0,
          defaultShelfHours: item.defaultShelfHours || 24,
          sampleImages: sampleImagesJson,
          visualKeywords: item.visualKeywords || null
        }
      });
      console.log(`✨ [Tạo mới]  SKU: ${sku.padEnd(20)} | ${item.name} (${item.basePrice.toLocaleString('vi-VN')}đ -> Sàn: ${item.minPrice.toLocaleString('vi-VN')}đ)`);
      createdCount++;
    }
  }

  console.log('\n==============================================');
  console.log(`🎉 HOÀN TẤT IMPORT!`);
  console.log(`   - Tổng sản phẩm đã tạo mới: ${createdCount}`);
  console.log(`   - Tổng sản phẩm đã cập nhật: ${updatedCount}`);
  console.log('==============================================\n');
}

importCatalog()
  .catch((e) => {
    console.error('❌ Lỗi khi import:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

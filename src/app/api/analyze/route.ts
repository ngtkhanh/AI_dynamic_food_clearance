import { NextRequest, NextResponse } from 'next/server';
import { analyzeImageAndGeneratePricing } from '@/lib/ai';
import prisma from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'Missing image data' }, { status: 400 });
    }

    // Lấy danh mục sản phẩm (kèm visualKeywords và quy tắc giá) để đưa vào prompt
    const products = await prisma.product.findMany();
    const catalogStr = JSON.stringify(products.map(p => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      basePrice: p.basePrice,
      minPrice: p.minPrice,
      defaultShelfHours: p.defaultShelfHours,
      visualKeywords: p.visualKeywords
    })));

    const aiResult = await analyzeImageAndGeneratePricing(imageBase64, mimeType || 'image/jpeg', catalogStr);

    if (aiResult && aiResult.productId) {
      // Map ngược lại productId ra thông tin món hàng
      const matchedProduct = products.find((p: any) => p.id === aiResult.productId);
      if (matchedProduct) {
        aiResult.item_name = matchedProduct.name;
        aiResult.sku = matchedProduct.sku;
        aiResult.base_price = matchedProduct.basePrice;
        aiResult.min_price = matchedProduct.minPrice;
        aiResult.default_shelf_hours = matchedProduct.defaultShelfHours;
      }
    }

    return NextResponse.json({ data: aiResult });
  } catch (error: any) {
    console.error('Analyze API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

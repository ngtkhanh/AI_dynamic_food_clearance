import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ success: true, data: products });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, category, basePrice, minPrice, stockQuantity, defaultShelfHours, sampleImages, visualKeywords } = body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Tên sản phẩm không được để trống' }, { status: 400 });
    }

    const parsedBasePrice = Number(basePrice);
    const parsedMinPrice = Number(minPrice);
    const parsedStockQty = Math.max(0, parseInt(stockQuantity) || 0);
    const parsedShelfHours = Number(defaultShelfHours) || 24;

    if (isNaN(parsedBasePrice) || parsedBasePrice <= 0) {
      return NextResponse.json({ success: false, error: 'Giá niêm yết (basePrice) phải là số dương' }, { status: 400 });
    }

    if (isNaN(parsedMinPrice) || parsedMinPrice <= 0) {
      return NextResponse.json({ success: false, error: 'Giá sàn (minPrice) phải là số dương' }, { status: 400 });
    }

    if (parsedMinPrice > parsedBasePrice) {
      return NextResponse.json({ success: false, error: 'Giá sàn không được lớn hơn giá niêm yết' }, { status: 400 });
    }

    // Auto-generate SKU nếu không truyền vào
    const skuPrefix = (category || 'SKU')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6) || 'ITEM';
    const autoSku = body.sku || `${skuPrefix}-${Date.now().toString().slice(-6)}`;

    // Chuẩn hóa sampleImages thành chuỗi JSON
    let sampleImagesStr = '[]';
    if (Array.isArray(sampleImages)) {
      sampleImagesStr = JSON.stringify(sampleImages);
    } else if (typeof sampleImages === 'string' && sampleImages.trim().length > 0) {
      sampleImagesStr = sampleImages.startsWith('[') ? sampleImages : JSON.stringify([sampleImages]);
    }

    const newProduct = await prisma.product.create({
      data: {
        sku: autoSku,
        name: name.trim(),
        category: category?.trim() || 'General',
        basePrice: parsedBasePrice,
        minPrice: parsedMinPrice,
        stockQuantity: parsedStockQty,
        defaultShelfHours: parsedShelfHours,
        sampleImages: sampleImagesStr,
        visualKeywords: visualKeywords?.trim() || null,
      }
    });

    return NextResponse.json({ success: true, data: newProduct }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/products error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Lỗi server khi thêm sản phẩm' }, { status: 500 });
  }
}

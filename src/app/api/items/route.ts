import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const items = await prisma.clearanceItem.findMany({
      where: { currentQuantity: { gt: 0 }, expiresAt: { gt: new Date() } },
      include: { product: true },
      orderBy: { expiresAt: 'asc' }
    });
    return NextResponse.json({ data: items });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const qty = parseInt(body.quantity) || 1;
    
    // Set expiry to 2 hours from now by default if not provided
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : new Date(Date.now() + 2 * 60 * 60 * 1000);

    // Tìm product tương ứng trong catalog nếu có productId hoặc map theo tên
    let targetProductId = body.productId ? parseInt(body.productId) : null;
    if (!targetProductId && body.name) {
      const matched = await prisma.product.findFirst({
        where: { name: { equals: body.name.trim() } }
      });
      if (matched) targetProductId = matched.id;
    }

    // Chạy transaction để kiểm tra và trừ tồn kho trong Master Catalog nếu có liên kết sản phẩm
    const item = await prisma.$transaction(async (tx) => {
      if (targetProductId) {
        const product = await tx.product.findUnique({
          where: { id: targetProductId }
        });

        if (!product) {
          throw new Error('Không tìm thấy sản phẩm trong danh mục');
        }

        if (product.stockQuantity < qty) {
          throw new Error(`Số lượng xả kho (${qty}) vượt quá số lượng hàng có trong kho (${product.stockQuantity})!`);
        }

        // Trừ số lượng tồn kho trong kho
        await tx.product.update({
          where: { id: targetProductId },
          data: { stockQuantity: product.stockQuantity - qty }
        });
      }

      // Tạo đợt xả kho mới
      return await tx.clearanceItem.create({
        data: {
          productId: targetProductId,
          name: body.name,
          originalPrice: body.originalPrice,
          currentPrice: body.originalPrice,
          initialQuantity: qty,
          currentQuantity: qty,
          expiresAt: expiresAt,
          imageUrl: body.imageUrl || null,
          aiPricingStrategy: body.aiPricingStrategy ? JSON.stringify(body.aiPricingStrategy) : null,
          aiRationale: body.aiRationale || null
        },
        include: { product: true }
      });
    });

    return NextResponse.json({ success: true, data: item });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

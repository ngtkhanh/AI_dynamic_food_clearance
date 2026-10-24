import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const itemId = parseInt(id);

    await prisma.$transaction(async (tx) => {
      const item = await tx.clearanceItem.findUnique({
        where: { id: itemId }
      });

      if (!item) {
        throw new Error('Không tìm thấy mặt hàng xả kho');
      }

      // Nếu còn hàng trên kệ và có liên kết sản phẩm trong kho -> Hoàn trả lại số lượng về kho
      if (item.currentQuantity > 0 && item.productId) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: { increment: item.currentQuantity }
          }
        });
      }

      // Dừng xả kho: đưa expiresAt về quá khứ và đặt currentQuantity = 0
      await tx.clearanceItem.update({
        where: { id: itemId },
        data: {
          currentQuantity: 0,
          status: 'STOPPED',
          expiresAt: new Date(Date.now() - 60000)
        }
      });
    });

    return NextResponse.json({ success: true, message: 'Đã dừng xả kho và hoàn trả hàng về kho thành công' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

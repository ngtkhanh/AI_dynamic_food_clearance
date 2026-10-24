import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId);

    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'ID sản phẩm không hợp lệ' }, { status: 400 });
    }

    // Kiểm tra sản phẩm tồn tại
    const existing = await prisma.product.findUnique({
      where: { id }
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy sản phẩm' }, { status: 404 });
    }

    // Gỡ liên kết các đợt xả kho cũ (nếu có) để tránh lỗi foreign key constraint
    await prisma.clearanceItem.updateMany({
      where: { productId: id },
      data: { productId: null }
    });

    // Xóa sản phẩm khỏi danh mục
    await prisma.product.delete({
      where: { id }
    });

    return NextResponse.json({ 
      success: true, 
      message: `Đã xóa sản phẩm "${existing.name}" khỏi danh mục thành công` 
    });
  } catch (error: any) {
    console.error('DELETE /api/products/[id] error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Lỗi server khi xóa sản phẩm' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId);

    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'ID sản phẩm không hợp lệ' }, { status: 400 });
    }

    const body = await req.json();

    if (body.basePrice !== undefined && (isNaN(Number(body.basePrice)) || Number(body.basePrice) <= 0)) {
      return NextResponse.json({ success: false, error: 'Giá niêm yết phải lớn hơn 0' }, { status: 400 });
    }
    if (body.minPrice !== undefined && (isNaN(Number(body.minPrice)) || Number(body.minPrice) <= 0)) {
      return NextResponse.json({ success: false, error: 'Giá sàn phải lớn hơn 0' }, { status: 400 });
    }
    if (body.basePrice !== undefined && body.minPrice !== undefined && Number(body.minPrice) > Number(body.basePrice)) {
      return NextResponse.json({ success: false, error: 'Giá sàn không được lớn hơn giá niêm yết' }, { status: 400 });
    }

    let sampleImagesStr = undefined;
    if (body.sampleImages !== undefined) {
      if (Array.isArray(body.sampleImages)) {
        sampleImagesStr = JSON.stringify(body.sampleImages);
      } else if (typeof body.sampleImages === 'string' && body.sampleImages.trim().length > 0) {
        sampleImagesStr = body.sampleImages.startsWith('[') ? body.sampleImages : JSON.stringify([body.sampleImages]);
      } else {
        sampleImagesStr = '[]';
      }
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name.trim() }),
        ...(body.category && { category: body.category.trim() }),
        ...(body.basePrice && { basePrice: Number(body.basePrice) }),
        ...(body.minPrice && { minPrice: Number(body.minPrice) }),
        ...(body.stockQuantity !== undefined && { stockQuantity: Math.max(0, parseInt(body.stockQuantity) || 0) }),
        ...(body.defaultShelfHours && { defaultShelfHours: Number(body.defaultShelfHours) }),
        ...(body.visualKeywords !== undefined && { visualKeywords: body.visualKeywords?.trim() || null }),
        ...(sampleImagesStr !== undefined && { sampleImages: sampleImagesStr })
      }
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('PATCH /api/products/[id] error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Lỗi server khi cập nhật sản phẩm' }, { status: 500 });
  }
}

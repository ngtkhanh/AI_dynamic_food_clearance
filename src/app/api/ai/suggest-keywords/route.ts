import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { name, category } = await req.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Vui lòng nhập tên sản phẩm trước' }, { status: 400 });
    }

    const prompt = `
Bạn là một chuyên gia AI Computer Vision cho hệ thống bán lẻ thực phẩm thông minh.
Sản phẩm: "${name.trim()}" ${category ? `(Ngành hàng: ${category})` : ''}.

Hãy mô tả các đặc điểm nhận diện thị giác nổi bật nhất của món này ngoài đời thực để mô hình AI Vision phân tích ảnh chụp camera kệ hàng có thể so khớp chính xác (bao gồm: màu sắc chủ đạo, hình dáng, kết cấu bề mặt, topping hoặc kiểu hộp/bao bì đặc trưng).

YÊU CẦU QUAN TRỌNG:
- Chỉ trả về 1 câu văn tự nhiên bằng tiếng Việt (độ dài 15 đến 30 từ).
- KHÔNG thêm tiêu đề, KHÔNG gạch đầu dòng, KHÔNG ngoặc kép.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    const keywords = response.text?.trim().replace(/^["']|["']$/g, '') || '';

    return NextResponse.json({ success: true, data: { keywords } });
  } catch (error: any) {
    console.error('Suggest Keywords API Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Lỗi khi gọi AI' }, { status: 500 });
  }
}

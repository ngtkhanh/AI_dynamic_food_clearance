# Thư mục chứa ảnh mẫu sản phẩm (Sample Reference Images)

Thả các file ảnh mẫu vào thư mục này để hệ thống tự động copy sang `public/catalog/` khi chạy import:
- `BREAD-CROISSANT-01.jpg`
- `BREAD-BAGUETTE-01.jpg`
- `BAKERY-DONUT-CHOCO-01.jpg`
- `FRUIT-MIX-CUP-01.jpg`
- `SALAD-VEGGIE-EGG-01.jpg`
- `DRINK-COLD-BREW-01.jpg`

Khi chạy `npm run catalog:import`, script sẽ:
1. Đọc danh mục từ `data/catalog/products.json`.
2. Kiểm tra và đồng bộ ảnh từ thư mục này sang `public/catalog/`.
3. Cập nhật thông tin vào Database qua Prisma.

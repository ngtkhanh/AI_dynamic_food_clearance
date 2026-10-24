'use client';

import { useState, useRef } from 'react';
import useSWR from 'swr';
import { 
  Plus, 
  Trash2, 
  Camera, 
  Zap, 
  Sparkles, 
  Clock, 
  AlertCircle, 
  PackageOpen, 
  RefreshCw, 
  Check, 
  X,
  Layers,
  Wand2,
  Pencil
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const CATEGORIES = [
  'Bakery',
  'Fresh Produce',
  'Beverages',
  'Ready-to-eat',
  'Dairy & Eggs',
  'Snacks',
  'Khác'
];

// Helper: Chuyển đổi tổng số giờ sang định dạng "X tháng Y ngày Z giờ"
function formatShelfLife(totalHours: number): string {
  if (!totalHours || totalHours <= 0) return '24 giờ';
  const months = Math.floor(totalHours / 720); // 30 ngày = 720 giờ
  const remainingAfterMonths = totalHours % 720;
  const days = Math.floor(remainingAfterMonths / 24);
  const hours = remainingAfterMonths % 24;

  const parts: string[] = [];
  if (months > 0) parts.push(`${months} tháng`);
  if (days > 0) parts.push(`${days} ngày`);
  if (hours > 0) parts.push(`${hours} giờ`);
  return parts.length > 0 ? parts.join(' ') : `${totalHours} giờ`;
}

export default function CatalogManager({ onRefreshParent }: { onRefreshParent?: () => void }) {
  const { data: response, error, isLoading, mutate } = useSWR('/api/products', fetcher);
  const products = response?.data || [];

  // Lấy dữ liệu kệ xả kho hiện tại để đếm số lượng đang có của mỗi sản phẩm
  const { data: itemsResponse } = useSWR('/api/items', fetcher, { refreshInterval: 5000 });
  const activeClearanceItems = itemsResponse?.data || [];

  // Form State (Thêm mới)
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingKeywords, setIsGeneratingKeywords] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Bakery');
  const [basePrice, setBasePrice] = useState<number | ''>('');
  const [minPrice, setMinPrice] = useState<number | ''>('');
  const [stockQuantity, setStockQuantity] = useState<number | ''>(20);
  const [shelfDays, setShelfDays] = useState<number>(1);
  const [shelfHours, setShelfHours] = useState<number>(0);
  const [visualKeywords, setVisualKeywords] = useState('');
  const [sampleImage, setSampleImage] = useState<string | null>(null);

  // Edit Modal State (Chỉnh sửa)
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('Bakery');
  const [editBasePrice, setEditBasePrice] = useState<number | ''>('');
  const [editMinPrice, setEditMinPrice] = useState<number | ''>('');
  const [editStockQuantity, setEditStockQuantity] = useState<number | ''>(0);
  const [editShelfDays, setEditShelfDays] = useState<number>(1);
  const [editShelfHours, setEditShelfHours] = useState<number>(0);
  const [editVisualKeywords, setEditVisualKeywords] = useState('');
  const [editSampleImage, setEditSampleImage] = useState<string | null>(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [isEditGeneratingKeywords, setIsEditGeneratingKeywords] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Track ảnh bị lỗi load
  const [brokenImages, setBrokenImages] = useState<Record<number, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Quick Clearance Modal State
  const [quickClearanceProduct, setQuickClearanceProduct] = useState<any | null>(null);
  const [quickQuantity, setQuickQuantity] = useState<number>(5);
  const [quickHours, setQuickHours] = useState<number>(3);
  const [isPublishingClearance, setIsPublishingClearance] = useState(false);

  // Tính tổng số giờ hạn dùng từ Days + Hours
  const totalShelfHours = Math.max(1, (shelfDays * 24) + shelfHours);
  const totalEditShelfHours = Math.max(1, (editShelfDays * 24) + editShelfHours);

  // AI gợi ý từ khóa thị giác cho Form Thêm
  const handleAutoGenerateKeywords = async () => {
    if (!name.trim()) {
      setFormError('Vui lòng nhập tên món ăn trước khi yêu cầu AI gợi ý.');
      return;
    }

    setIsGeneratingKeywords(true);
    setFormError(null);

    try {
      const res = await fetch('/api/ai/suggest-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), category })
      });

      const result = await res.json();
      if (result.success && result.data?.keywords) {
        setVisualKeywords(result.data.keywords);
      } else {
        throw new Error(result.error || 'AI không phản hồi');
      }
    } catch (err: any) {
      setFormError(err.message || 'Không thể tạo gợi ý từ khóa bằng AI');
    } finally {
      setIsGeneratingKeywords(false);
    }
  };

  // AI gợi ý từ khóa thị giác cho Form Sửa
  const handleEditAutoGenerateKeywords = async () => {
    if (!editName.trim()) {
      setEditError('Vui lòng nhập tên món ăn trước.');
      return;
    }

    setIsEditGeneratingKeywords(true);
    setEditError(null);

    try {
      const res = await fetch('/api/ai/suggest-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), category: editCategory })
      });

      const result = await res.json();
      if (result.success && result.data?.keywords) {
        setEditVisualKeywords(result.data.keywords);
      }
    } catch (err: any) {
      setEditError(err.message || 'Lỗi khi gọi AI');
    } finally {
      setIsEditGeneratingKeywords(false);
    }
  };

  // Mở modal Chỉnh sửa sản phẩm
  const handleOpenEdit = (product: any) => {
    setEditingProduct(product);
    setEditName(product.name);
    setEditCategory(product.category || 'Bakery');
    setEditBasePrice(product.basePrice);
    setEditMinPrice(product.minPrice);
    setEditStockQuantity(product.stockQuantity ?? 0);
    
    const totalHours = product.defaultShelfHours || 24;
    setEditShelfDays(Math.floor(totalHours / 24));
    setEditShelfHours(totalHours % 24);
    
    setEditVisualKeywords(product.visualKeywords || '');

    let img = null;
    try {
      const parsed = JSON.parse(product.sampleImages || '[]');
      img = Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : product.sampleImages;
    } catch {
      img = product.sampleImages;
    }
    setEditSampleImage(img);
    setEditError(null);
  };

  // Lưu chỉnh sửa sản phẩm
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setEditError(null);

    const numBase = Number(editBasePrice);
    const numMin = Number(editMinPrice);

    if (!editName.trim()) {
      setEditError('Tên sản phẩm không được để trống.');
      return;
    }
    if (!numBase || numBase <= 0) {
      setEditError('Giá niêm yết phải lớn hơn 0.');
      return;
    }
    if (!numMin || numMin <= 0) {
      setEditError('Giá sàn phải lớn hơn 0.');
      return;
    }
    if (numMin > numBase) {
      setEditError('Giá sàn không được lớn hơn giá niêm yết.');
      return;
    }

    setIsEditSubmitting(true);

    try {
      const res = await fetch(`/api/products/${editingProduct.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          category: editCategory,
          basePrice: numBase,
          minPrice: numMin,
          stockQuantity: typeof editStockQuantity === 'number' ? Math.max(0, editStockQuantity) : 0,
          defaultShelfHours: totalEditShelfHours,
          visualKeywords: editVisualKeywords.trim(),
          sampleImages: editSampleImage ? [editSampleImage] : []
        })
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Lỗi khi cập nhật sản phẩm');
      }

      setEditingProduct(null);
      mutate();
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      setEditError(err.message || 'Lỗi khi lưu chỉnh sửa');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  // Chụp / Tải ảnh mẫu (Form thêm)
  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setSampleImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Chụp / Tải ảnh mẫu (Form sửa)
  const handleEditPhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setEditSampleImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Tạo sản phẩm mới
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!name.trim()) {
      setFormError('Vui lòng nhập tên sản phẩm.');
      return;
    }

    const numBase = Number(basePrice);
    const numMin = Number(minPrice);

    if (!numBase || numBase <= 0) {
      setFormError('Giá niêm yết phải lớn hơn 0.');
      return;
    }
    if (!numMin || numMin <= 0) {
      setFormError('Giá sàn phải lớn hơn 0.');
      return;
    }
    if (numMin > numBase) {
      setFormError('Giá sàn không được cao hơn giá niêm yết.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category,
          basePrice: numBase,
          minPrice: numMin,
          stockQuantity: typeof stockQuantity === 'number' ? Math.max(0, stockQuantity) : 0,
          defaultShelfHours: totalShelfHours,
          visualKeywords: visualKeywords.trim(),
          sampleImages: sampleImage ? [sampleImage] : []
        })
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Lỗi khi lưu sản phẩm');
      }

      setFormSuccess(`Đã thêm "${name}" vào danh mục thành công!`);
      setName('');
      setBasePrice('');
      setMinPrice('');
      setStockQuantity(20);
      setShelfDays(1);
      setShelfHours(0);
      setVisualKeywords('');
      setSampleImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      mutate();
      if (onRefreshParent) onRefreshParent();

      setTimeout(() => {
        setFormSuccess(null);
        setShowForm(false);
      }, 1500);
    } catch (err: any) {
      setFormError(err.message || 'Lỗi kết nối tới máy chủ');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xóa sản phẩm
  const handleDeleteProduct = async (id: number, productName: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa "${productName}" khỏi danh mục mẫu không?`)) return;

    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        mutate();
        if (onRefreshParent) onRefreshParent();
      } else {
        alert(result.error || 'Không thể xóa sản phẩm.');
      }
    } catch (err) {
      alert('Lỗi kết nối khi xóa sản phẩm.');
    }
  };

  // Đưa lên xả kho nhanh
  const handleLaunchClearance = async () => {
    if (!quickClearanceProduct) return;

    const availableStock = quickClearanceProduct.stockQuantity ?? 0;
    if (availableStock <= 0) {
      alert('Sản phẩm này đã hết hàng trong kho, không thể xả kho!');
      return;
    }
    if (quickQuantity > availableStock) {
      alert(`Số lượng xả kho (${quickQuantity}) vượt quá số lượng hàng có trong kho (${availableStock})!`);
      return;
    }

    setIsPublishingClearance(true);

    try {
      const expiresAt = new Date(Date.now() + quickHours * 60 * 60 * 1000);
      
      let sampleImg = null;
      try {
        const imgs = JSON.parse(quickClearanceProduct.sampleImages || '[]');
        if (imgs.length > 0) sampleImg = imgs[0];
      } catch (e) {
        sampleImg = quickClearanceProduct.sampleImages;
      }

      const base = quickClearanceProduct.basePrice;
      const min = quickClearanceProduct.minPrice;
      const step = Math.round((base - min) / 3);

      const decaySchedule = [
        { minutes_before_close: quickHours * 60, price: base },
        { minutes_before_close: Math.round((quickHours * 60) * 0.66), price: base - step },
        { minutes_before_close: Math.round((quickHours * 60) * 0.33), price: base - step * 2 },
        { minutes_before_close: 0, price: min }
      ];

      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: quickClearanceProduct.id,
          name: quickClearanceProduct.name,
          quantity: quickQuantity,
          originalPrice: base,
          expiresAt: expiresAt.toISOString(),
          imageUrl: sampleImg,
          aiPricingStrategy: { decay_schedule: decaySchedule },
          aiRationale: `Kích hoạt xả kho nhanh từ Danh mục (${quickHours}h trước khi hết date). Giá sàn bảo vệ vốn: ${min.toLocaleString('vi-VN')}đ.`
        })
      });

      const resData = await res.json();

      if (res.ok && resData.success) {
        setQuickClearanceProduct(null);
        mutate();
        if (onRefreshParent) onRefreshParent();
        alert(`Đã đưa ${quickQuantity} phần "${quickClearanceProduct.name}" lên Storefront thành công! Tồn kho đã được trừ tương ứng.`);
      } else {
        alert(resData.error || 'Lỗi khi đưa lên xả kho.');
      }
    } catch (err: any) {
      alert('Lỗi kết nối khi tạo đợt xả kho: ' + err.message);
    } finally {
      setIsPublishingClearance(false);
    }
  };

  return (
    <div style={{ marginTop: '2rem' }}>
      {/* SECTION HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Layers size={24} color="var(--color-primary-light)" />
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Danh mục Hàng hóa (Master Catalog)</h2>
          </div>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Quản lý kho hàng chuẩn & ảnh mẫu thị giác cho AI Vision nhận diện
          </p>
        </div>

        <button 
          onClick={() => setShowForm(!showForm)}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', fontSize: '0.95rem' }}
        >
          {showForm ? <X size={18} /> : <Plus size={18} />}
          {showForm ? 'Đóng Form' : 'Thêm Sản Phẩm Mới'}
        </button>
      </div>

      {/* QUICK ADD FORM (COLLAPSIBLE) */}
      {showForm && (
        <div 
          className="glass-card" 
          style={{ 
            padding: '1.8rem', 
            marginBottom: '2rem', 
            border: '1px solid var(--color-primary-dark)',
            animation: 'fadeIn 0.3s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
            <h3 style={{ margin: 0, color: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={18} /> Thêm Sản Phẩm Vào Database
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>* Dữ liệu dùng đối chiếu giá & AI Vision</span>
          </div>

          {formError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--color-error)', color: '#fca5a5', padding: '0.8rem 1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={18} />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid var(--color-primary)', color: 'var(--color-primary-light)', padding: '0.8rem 1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Check size={18} />
              <span>{formSuccess}</span>
            </div>
          )}

          <form onSubmit={handleCreateProduct}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.2rem', marginBottom: '1.2rem' }}>
              {/* Tên sản phẩm */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '0.4rem' }}>
                  Tên sản phẩm <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <input 
                  type="text"
                  placeholder="VD: Bánh Mì Bơ Tỏi Nướng"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{ width: '100%', padding: '0.7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'white' }}
                  required
                />
              </div>

              {/* Phân loại */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '0.4rem' }}>
                  Ngành hàng / Phân loại
                </label>
                <select 
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  style={{ width: '100%', padding: '0.7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'white' }}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Giá niêm yết */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '0.4rem' }}>
                  Giá niêm yết (VNĐ) <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <input 
                  type="number"
                  placeholder="30000"
                  value={basePrice}
                  onChange={e => setBasePrice(e.target.value ? Number(e.target.value) : '')}
                  style={{ width: '100%', padding: '0.7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'white' }}
                  required
                />
              </div>

              {/* Giá sàn */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '0.4rem' }}>
                  Giá sàn bảo vệ vốn (VNĐ) <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <input 
                  type="number"
                  placeholder="12000"
                  value={minPrice}
                  onChange={e => setMinPrice(e.target.value ? Number(e.target.value) : '')}
                  style={{ width: '100%', padding: '0.7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'white' }}
                  required
                />
              </div>

              {/* Số lượng tồn kho */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '0.4rem' }}>
                  Số lượng tồn kho (Hàng sẵn có) <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <input 
                  type="number"
                  min="0"
                  placeholder="20"
                  value={stockQuantity}
                  onChange={e => setStockQuantity(e.target.value ? Math.max(0, parseInt(e.target.value) || 0) : '')}
                  style={{ width: '100%', padding: '0.7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'white' }}
                  required
                />
              </div>

              {/* Thời hạn chuẩn dạng Ngày / Giờ */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '0.4rem' }}>
                  Thời hạn sử dụng chuẩn (Tháng / Ngày / Giờ)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input 
                        type="number"
                        min="0"
                        value={shelfDays}
                        onChange={e => setShelfDays(Math.max(0, parseInt(e.target.value) || 0))}
                        style={{ width: '100%', padding: '0.7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'white' }}
                      />
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>Ngày</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input 
                        type="number"
                        min="0"
                        max="23"
                        value={shelfHours}
                        onChange={e => setShelfHours(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                        style={{ width: '100%', padding: '0.7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'white' }}
                      />
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>Giờ</span>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '0.3rem', fontSize: '0.75rem', color: 'var(--color-primary-light)' }}>
                  ⏳ Thời hạn quy đổi: <strong>{formatShelfLife(totalShelfHours)}</strong> ({totalShelfHours} giờ)
                </div>
              </div>
            </div>

            {/* AI gợi ý đặc điểm nhận diện */}
            <div style={{ marginBottom: '1.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                  Đặc điểm nhận diện cho AI Vision (Keywords & Visual Clues)
                </label>

                <button
                  type="button"
                  onClick={handleAutoGenerateKeywords}
                  disabled={isGeneratingKeywords || !name.trim()}
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: 'white',
                    border: 'none',
                    padding: '0.35rem 0.8rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    cursor: (!name.trim() || isGeneratingKeywords) ? 'not-allowed' : 'pointer',
                    opacity: (!name.trim() || isGeneratingKeywords) ? 0.6 : 1,
                    boxShadow: '0 2px 6px rgba(99, 102, 241, 0.3)'
                  }}
                >
                  <Wand2 size={13} className={isGeneratingKeywords ? 'animate-spin' : ''} />
                  {isGeneratingKeywords ? 'AI đang phân tích...' : '✨ AI Tự Điền Đặc Điểm'}
                </button>
              </div>

              <input 
                type="text"
                placeholder="Nhập tên món rồi bấm '✨ AI Tự Điền Đặc Điểm' để Gemini tự động mô tả..."
                value={visualKeywords}
                onChange={e => setVisualKeywords(e.target.value)}
                style={{ width: '100%', padding: '0.7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'white' }}
              />
            </div>

            {/* Chụp / Tải ảnh mẫu */}
            <div style={{ marginBottom: '1.5rem', background: 'var(--color-surface)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>Ảnh mẫu sản phẩm (Chụp trực tiếp từ điện thoại)</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>AI sẽ dùng ảnh này để so khớp khi quét kệ hàng</p>
                </div>
                
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  onChange={handlePhotoCapture} 
                />

                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ background: 'var(--color-surface-elevated)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
                >
                  <Camera size={16} /> {sampleImage ? 'Chụp / Chọn ảnh khác' : 'Chụp / Tải ảnh mẫu'}
                </button>
              </div>

              {sampleImage && (
                <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <img src={sampleImage} alt="Sample Preview" style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-primary)' }} />
                  <div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Check size={14} /> Đã chọn ảnh mẫu
                    </span>
                    <button 
                      type="button" 
                      onClick={() => setSampleImage(null)}
                      style={{ background: 'transparent', color: 'var(--color-error)', padding: 0, fontSize: '0.75rem', marginTop: '0.2rem', textDecoration: 'underline' }}
                    >
                      Gỡ ảnh
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button 
                type="button" 
                onClick={() => setShowForm(false)}
                style={{ background: 'transparent', color: 'var(--color-text-secondary)', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-md)' }}
              >
                Hủy
              </button>

              <button 
                type="submit" 
                className="btn-primary"
                disabled={isSubmitting}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: isSubmitting ? 0.7 : 1 }}
              >
                {isSubmitting ? <RefreshCw className="animate-spin" size={18} /> : <Check size={18} />}
                {isSubmitting ? 'Đang lưu vào DB...' : 'Lưu Sản Phẩm Vào Database'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STATE 1: LOADING SKELETON */}
      {isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.2rem' }}>
          {[1, 2, 3].map(n => (
            <div key={n} className="glass-card" style={{ padding: '1.5rem' }}>
              <div className="skeleton" style={{ height: '140px', width: '100%', marginBottom: '1rem' }} />
              <div className="skeleton" style={{ height: '20px', width: '70%', marginBottom: '0.6rem' }} />
              <div className="skeleton" style={{ height: '16px', width: '40%', marginBottom: '1rem' }} />
              <div className="skeleton" style={{ height: '36px', width: '100%' }} />
            </div>
          ))}
        </div>
      )}

      {/* STATE 2: ERROR STATE WITH RETRY */}
      {error && !isLoading && (
        <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', border: '1px solid var(--color-error)' }}>
          <AlertCircle size={40} color="var(--color-error)" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ color: 'var(--color-error)', marginBottom: '0.5rem' }}>Không thể tải danh mục sản phẩm</h3>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>{error.message || 'Lỗi kết nối cơ sở dữ liệu'}</p>
          <button onClick={() => mutate()} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <RefreshCw size={16} /> Thử lại
          </button>
        </div>
      )}

      {/* STATE 3: EMPTY STATE */}
      {!isLoading && !error && products.length === 0 && (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <PackageOpen size={48} color="var(--color-text-muted)" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>Danh mục sản phẩm đang trống</h3>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
            Bạn chưa thêm mặt hàng nào vào Database. Hãy thêm mặt hàng đầu tiên để kích hoạt tính năng nhận diện AI!
          </p>
          <button onClick={() => setShowForm(true)} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={16} /> Thêm sản phẩm đầu tiên
          </button>
        </div>
      )}

      {/* STATE 4: SUCCESS STATE (PRODUCT GRID) */}
      {!isLoading && !error && products.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.2rem' }}>
          {products.map((product: any) => {
            let sampleImg = null;
            try {
              const imgs = JSON.parse(product.sampleImages || '[]');
              if (imgs.length > 0) sampleImg = imgs[0];
            } catch (e) {
              sampleImg = product.sampleImages;
            }

            const isBroken = brokenImages[product.id];

            // TÍNH TOÁN SỐ LƯỢNG ĐANG CÓ TRÊN KỆ XẢ KHO
            const currentClearanceQty = activeClearanceItems
              .filter((item: any) => item.productId === product.id || item.name?.toLowerCase() === product.name?.toLowerCase())
              .reduce((sum: number, it: any) => sum + (it.currentQuantity || 0), 0);

            return (
              <div 
                key={product.id} 
                className="glass-card" 
                style={{ 
                  padding: '1.2rem', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between',
                  border: '1px solid var(--color-border)',
                  position: 'relative'
                }}
              >
                <div>
                  {/* Image & Badge */}
                  <div style={{ position: 'relative', height: '140px', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {sampleImg && !isBroken ? (
                      <img 
                        src={sampleImg} 
                        alt={product.name} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        onError={() => setBrokenImages(prev => ({ ...prev, [product.id]: true }))}
                      />
                    ) : (
                      <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <Camera size={28} style={{ margin: '0 auto 0.3rem', opacity: 0.5 }} />
                        <span style={{ fontSize: '0.75rem', display: 'block' }}>Chưa có ảnh mẫu</span>
                      </div>
                    )}
                    
                    <span style={{ position: 'absolute', top: '8px', left: '8px', background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(4px)', color: 'var(--color-primary-light)', fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      {product.category || 'Bakery'}
                    </span>

                    {product.sku && (
                      <span style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0, 0, 0, 0.75)', color: '#94a3b8', fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-sm)' }}>
                        {product.sku}
                      </span>
                    )}
                  </div>

                  {/* HUY HIỆU HIỂN THỊ SỐ LƯỢNG TỒN KHO & ĐANG XẢ KHO */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }}>
                    {/* Tồn kho trong database */}
                    <span style={{ 
                      background: (product.stockQuantity || 0) > 0 ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)', 
                      color: (product.stockQuantity || 0) > 0 ? '#60a5fa' : '#f87171', 
                      border: `1px solid ${(product.stockQuantity || 0) > 0 ? 'rgba(59, 130, 246, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`, 
                      padding: '0.2rem 0.5rem', 
                      borderRadius: 'var(--radius-sm)', 
                      fontSize: '0.75rem', 
                      fontWeight: 600, 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '0.3rem' 
                    }}>
                      📦 Kho: <strong>{product.stockQuantity ?? 0}</strong>
                    </span>

                    {/* Kệ xả kho */}
                    {currentClearanceQty > 0 ? (
                      <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-primary-light)', border: '1px solid var(--color-primary-dark)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', display: 'inline-block' }} />
                        Đang xả: <strong>{currentClearanceQty}</strong>
                      </span>
                    ) : (
                      <span style={{ background: 'rgba(100, 116, 139, 0.15)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        Chưa xả kho
                      </span>
                    )}
                  </div>

                  {/* Title & Prices */}
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: 'var(--color-text-primary)' }}>{product.name}</h4>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.6rem' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Giá niêm yết</span>
                      <strong style={{ color: 'var(--color-text-primary)', fontSize: '1rem' }}>
                        {product.basePrice.toLocaleString('vi-VN')}đ
                      </strong>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-warning)', display: 'block' }}>Giá sàn (Min)</span>
                      <strong style={{ color: 'var(--color-warning)', fontSize: '0.95rem' }}>
                        {product.minPrice.toLocaleString('vi-VN')}đ
                      </strong>
                    </div>
                  </div>

                  {/* Visual Clues */}
                  {product.visualKeywords && (
                    <div style={{ background: 'var(--color-bg)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.8rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                      <span style={{ color: 'var(--color-primary-light)', fontWeight: 600 }}>🤖 AI Clues:</span> {product.visualKeywords}
                    </div>
                  )}

                  {/* Thời hạn chuẩn */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                    <Clock size={13} />
                    <span>Hạn chuẩn: <strong>{formatShelfLife(product.defaultShelfHours)}</strong></span>
                  </div>
                </div>

                {/* Actions: Xả kho, Sửa, Xóa */}
                <div style={{ display: 'flex', gap: '0.4rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.8rem' }}>
                  <button 
                    onClick={() => {
                      setQuickClearanceProduct(product);
                      const available = product.stockQuantity ?? 0;
                      setQuickQuantity(available > 0 ? Math.min(5, available) : 1);
                    }}
                    style={{ flex: 2, background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))', color: 'white', padding: '0.5rem 0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                  >
                    <Zap size={14} /> Xả kho
                  </button>

                  <button 
                    onClick={() => handleOpenEdit(product)}
                    style={{ flex: 1, background: 'var(--color-surface-elevated)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', padding: '0.5rem 0.6rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', fontSize: '0.82rem', fontWeight: 500 }}
                    title="Chỉnh sửa thông tin"
                  >
                    <Pencil size={13} /> Sửa
                  </button>

                  <button 
                    onClick={() => handleDeleteProduct(product.id, product.name)}
                    style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--color-error)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.5rem 0.6rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Xóa khỏi danh mục"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: CHỈNH SỬA THÔNG TIN SẢN PHẨM */}
      {editingProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-card" style={{ maxWidth: '540px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.8rem', border: '1px solid var(--color-primary-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Pencil size={20} color="var(--color-primary-light)" />
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Chỉnh Sửa Thông Tin Sản Phẩm</h3>
              </div>
              <button 
                onClick={() => setEditingProduct(null)}
                style={{ background: 'transparent', color: 'var(--color-text-muted)', padding: '0.2rem' }}
              >
                <X size={20} />
              </button>
            </div>

            {editError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--color-error)', color: '#fca5a5', padding: '0.8rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                <AlertCircle size={16} />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '0.3rem' }}>Tên sản phẩm *</label>
                  <input 
                    type="text" 
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'white' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '0.3rem' }}>Phân loại</label>
                  <select 
                    value={editCategory}
                    onChange={e => setEditCategory(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'white' }}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '0.3rem' }}>Mã SKU</label>
                  <input 
                    type="text" 
                    value={editingProduct.sku || ''}
                    disabled
                    style={{ width: '100%', padding: '0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.3)', color: 'var(--color-text-muted)', cursor: 'not-allowed' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '0.3rem' }}>Giá niêm yết (VNĐ) *</label>
                  <input 
                    type="number" 
                    value={editBasePrice}
                    onChange={e => setEditBasePrice(e.target.value ? Number(e.target.value) : '')}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'white' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '0.3rem' }}>Giá sàn bảo vệ vốn (VNĐ) *</label>
                  <input 
                    type="number" 
                    value={editMinPrice}
                    onChange={e => setEditMinPrice(e.target.value ? Number(e.target.value) : '')}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'white' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '0.3rem' }}>Số lượng tồn kho (Hàng có sẵn) *</label>
                  <input 
                    type="number" 
                    min="0"
                    value={editStockQuantity}
                    onChange={e => setEditStockQuantity(e.target.value ? Math.max(0, parseInt(e.target.value) || 0) : '')}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'white' }}
                    required
                  />
                </div>

                {/* Hạn chuẩn */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '0.3rem' }}>Thời hạn chuẩn</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input 
                        type="number" 
                        min="0" 
                        value={editShelfDays}
                        onChange={e => setEditShelfDays(Math.max(0, parseInt(e.target.value) || 0))}
                        style={{ width: '100%', padding: '0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'white' }}
                      />
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Ngày</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input 
                        type="number" 
                        min="0" 
                        max="23"
                        value={editShelfHours}
                        onChange={e => setEditShelfHours(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                        style={{ width: '100%', padding: '0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'white' }}
                      />
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Giờ</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-primary-light)', display: 'block', marginTop: '0.2rem' }}>
                    ⏳ Quy đổi: <strong>{formatShelfLife(totalEditShelfHours)}</strong> ({totalEditShelfHours} giờ)
                  </span>
                </div>
              </div>

              {/* AI Clues */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: 0 }}>Đặc điểm nhận diện AI</label>
                  <button 
                    type="button"
                    onClick={handleEditAutoGenerateKeywords}
                    disabled={isEditGeneratingKeywords || !editName.trim()}
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', border: 'none', padding: '0.25rem 0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}
                  >
                    <Wand2 size={12} className={isEditGeneratingKeywords ? 'animate-spin' : ''} />
                    {isEditGeneratingKeywords ? 'AI đang viết...' : '✨ AI Viết Lại'}
                  </button>
                </div>
                <input 
                  type="text" 
                  value={editVisualKeywords}
                  onChange={e => setEditVisualKeywords(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'white' }}
                />
              </div>

              {/* Ảnh mẫu */}
              <div style={{ marginBottom: '1.2rem', background: 'var(--color-surface)', padding: '0.8rem', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--color-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Ảnh mẫu sản phẩm</span>
                  
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment" 
                    ref={editFileInputRef} 
                    style={{ display: 'none' }} 
                    onChange={handleEditPhotoCapture} 
                  />

                  <button 
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    style={{ background: 'var(--color-surface-elevated)', color: 'white', padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <Camera size={14} /> Đổi ảnh mẫu
                  </button>
                </div>

                {editSampleImage && (
                  <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <img src={editSampleImage} alt="Sample" style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-primary)' }} />
                    <button 
                      type="button" 
                      onClick={() => setEditSampleImage(null)}
                      style={{ background: 'transparent', color: 'var(--color-error)', fontSize: '0.75rem', padding: 0, textDecoration: 'underline' }}
                    >
                      Gỡ ảnh
                    </button>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem' }}>
                <button 
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  style={{ background: 'transparent', color: 'var(--color-text-secondary)', padding: '0.6rem 1.2rem', borderRadius: 'var(--radius-md)' }}
                >
                  Hủy
                </button>

                <button 
                  type="submit"
                  disabled={isEditSubmitting}
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.4rem' }}
                >
                  {isEditSubmitting ? <RefreshCw className="animate-spin" size={16} /> : <Check size={16} />}
                  {isEditSubmitting ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: QUICK CLEARANCE LAUNCH */}
      {quickClearanceProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-card" style={{ maxWidth: '420px', width: '100%', padding: '1.8rem', border: '1px solid var(--color-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-primary-light)', fontWeight: 600 }}>⚡ ĐƯA LÊN XẢ KHO NHANH</span>
                <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.2rem' }}>{quickClearanceProduct.name}</h3>
              </div>
              <button 
                onClick={() => setQuickClearanceProduct(null)}
                style={{ background: 'transparent', color: 'var(--color-text-muted)', padding: '0.2rem' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ background: 'var(--color-bg)', padding: '0.8rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.2rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Tồn kho hiện có:</span>
                <strong style={{ color: '#60a5fa' }}>📦 {quickClearanceProduct.stockQuantity ?? 0} sản phẩm</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Giá niêm yết:</span>
                <strong>{quickClearanceProduct.basePrice.toLocaleString('vi-VN')}đ</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-warning)' }}>Giá sàn bảo vệ vốn:</span>
                <strong style={{ color: 'var(--color-warning)' }}>{quickClearanceProduct.minPrice.toLocaleString('vi-VN')}đ</strong>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '0.3rem' }}>
                Số lượng đưa lên kệ xả kho (Tối đa: {quickClearanceProduct.stockQuantity ?? 0})
              </label>
              <input 
                type="number"
                min="1"
                max={Math.max(1, quickClearanceProduct.stockQuantity ?? 1)}
                value={quickQuantity}
                onChange={e => setQuickQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: '100%', padding: '0.7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'white' }}
              />
              {quickClearanceProduct.stockQuantity !== undefined && quickQuantity > quickClearanceProduct.stockQuantity && (
                <p style={{ margin: '0.4rem 0 0', color: '#fca5a5', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  ⚠️ Số lượng xả kho ({quickQuantity}) đang vượt quá tồn kho sẵn có ({quickClearanceProduct.stockQuantity}).
                </p>
              )}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '0.3rem' }}>
                Thời gian xả kho (Giờ đến khi đóng cửa / hết hạn)
              </label>
              <select 
                value={quickHours}
                onChange={e => setQuickHours(Number(e.target.value))}
                style={{ width: '100%', padding: '0.7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'white' }}
              >
                <option value={1}>1 Giờ (Gấp - Giảm nhanh)</option>
                <option value={2}>2 Giờ (Tiêu chuẩn buổi tối)</option>
                <option value={3}>3 Giờ</option>
                <option value={4}>4 Giờ</option>
                <option value={6}>6 Giờ</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button 
                onClick={() => setQuickClearanceProduct(null)}
                style={{ flex: 1, background: 'var(--color-surface)', color: 'var(--color-text-secondary)', padding: '0.7rem', borderRadius: 'var(--radius-md)' }}
              >
                Hủy
              </button>

              <button 
                onClick={handleLaunchClearance}
                disabled={isPublishingClearance || (quickClearanceProduct.stockQuantity !== undefined && quickQuantity > quickClearanceProduct.stockQuantity) || (quickClearanceProduct.stockQuantity ?? 0) <= 0}
                className="btn-primary"
                style={{ 
                  flex: 2, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '0.4rem',
                  opacity: (isPublishingClearance || (quickClearanceProduct.stockQuantity !== undefined && quickQuantity > quickClearanceProduct.stockQuantity) || (quickClearanceProduct.stockQuantity ?? 0) <= 0) ? 0.5 : 1,
                  cursor: (isPublishingClearance || (quickClearanceProduct.stockQuantity !== undefined && quickQuantity > quickClearanceProduct.stockQuantity) || (quickClearanceProduct.stockQuantity ?? 0) <= 0) ? 'not-allowed' : 'pointer'
                }}
              >
                {isPublishingClearance ? <RefreshCw className="animate-spin" size={16} /> : <Zap size={16} />}
                {isPublishingClearance ? 'Đang đưa lên...' : 'Đưa Lên Storefront'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

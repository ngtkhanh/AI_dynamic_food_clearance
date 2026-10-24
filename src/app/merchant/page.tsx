'use client';
import { useState, useRef } from 'react';
import useSWR from 'swr';
import { Camera, UploadCloud, CheckCircle2, Clock, Package, Image as ImageIcon, Layers } from 'lucide-react';
import EcoDashboard from '../components/EcoDashboard';
import CatalogManager from '../components/CatalogManager';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function MerchantPage() {
  const [activeTab, setActiveTab] = useState<'operations' | 'catalog'>('operations');
  const [isScanning, setIsScanning] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: catalogData, mutate: mutateCatalog } = useSWR('/api/products', fetcher);
  const { data: itemsData, mutate } = useSWR('/api/items', fetcher);
  const { data: ordersData, mutate: mutateOrders } = useSWR('/api/merchant/orders', fetcher, { refreshInterval: 5000 });


  const handleRealUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setAiResult(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setUploadedImage(base64);

      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64.split(',')[1], mimeType: file.type })
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data.data) {
            setAiResult(data.data);
          } else {
            alert('AI không nhận diện được món hàng.');
          }
        } else {
          alert('Lỗi API Analyze.');
        }
      } catch (error) {
        console.error(error);
        alert('Lỗi kết nối.');
      } finally {
        setIsScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePublish = async () => {
    if (!aiResult) return;
    
    // Tìm sản phẩm tương ứng trong catalog
    const matched = catalogData?.data?.find((p: any) => 
      p.id === aiResult.productId || p.name?.toLowerCase() === aiResult.item_name?.toLowerCase()
    );
    const availableStock = matched?.stockQuantity ?? 0;
    const requestedQty = parseInt(aiResult.quantity) || 1;

    if (matched && requestedQty > availableStock) {
      alert(`Số lượng xả kho (${requestedQty}) vượt quá số lượng hàng có trong kho (${availableStock})!`);
      return;
    }
    
    // Override the lowest price in the decay schedule
    const finalDecaySchedule = [...(aiResult.decay_schedule || [])];
    if (finalDecaySchedule.length > 0) {
      finalDecaySchedule.sort((a, b) => b.minutes_before_close - a.minutes_before_close);
      finalDecaySchedule[finalDecaySchedule.length - 1].price = aiResult.min_price;
    }

    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: matched?.id || aiResult.productId || null,
          name: aiResult.item_name,
          quantity: requestedQty,
          originalPrice: aiResult.base_price,
          imageUrl: uploadedImage,
          aiPricingStrategy: { decay_schedule: finalDecaySchedule },
          aiRationale: aiResult.ai_rationale
        })
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        alert(resData.error || 'Lỗi khi đưa lên Storefront');
        return;
      }

      setAiResult(null);
      setUploadedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      mutate(); // Làm mới danh sách kệ xả kho
      mutateCatalog(); // Làm mới số lượng tồn kho trong Master Catalog
      alert(`Đã đưa ${requestedQty} phần "${aiResult.item_name}" lên Storefront thành công! Tồn kho đã được trừ tương ứng.`);
    } catch (err: any) {
      alert('Lỗi kết nối khi xả kho: ' + err.message);
    }
  };

  const handleStop = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn dừng đợt xả kho này? Số lượng chưa bán sẽ được hoàn trả về Kho.')) return;
    try {
      const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
      const resData = await res.json();
      if (res.ok) {
        mutate(); // Làm mới kệ xả kho
        mutateCatalog(); // Làm mới số lượng kho
        alert(resData.message || 'Đã dừng xả kho và hoàn trả hàng về kho thành công!');
      } else {
        alert(resData.error || 'Không thể dừng xả kho');
      }
    } catch (err) {
      alert('Lỗi kết nối khi dừng xả kho');
    }
  };

  const handleOrderAction = async (id: number, action: 'COMPLETED' | 'CANCELLED') => {
    await fetch(`/api/merchant/orders/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    
    // Bắn tín hiệu sang Storefront để cập nhật giỏ hàng ngay lập tức (Real-time effect)
    localStorage.setItem('removeReceipt', JSON.stringify({ id, ts: Date.now() }));
    
    mutateOrders();
    if (action === 'CANCELLED') {
      mutate(); // Refresh inventory if cancelled
    }
  };

  const handleResetSystem = async () => {
    if (!confirm("CẢNH BÁO: Hành động này sẽ xóa sạch toàn bộ hàng hóa đang bán và lịch sử đơn hàng. Dùng để reset về số 0 trước khi Pitching. Chắc chắn tiếp tục?")) return;
    await fetch('/api/system/reset', { method: 'POST' });
    
    // Gửi tín hiệu sang tab Storefront để xóa giỏ hàng
    localStorage.setItem('forceReset', Date.now().toString());
    
    window.location.reload();
  };

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ color: 'var(--color-primary)' }}>Merchant Dashboard</h1>
          <p style={{ color: 'var(--color-text-muted)' }}>AI-Powered Clearance System</p>
        </div>
        <button onClick={handleResetSystem} className="btn-primary" style={{ background: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🔄 Reset Demo
        </button>
      </header>

      {/* TABS NAVIGATION */}
      <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '2rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.8rem', overflowX: 'auto' }}>
        <button
          onClick={() => setActiveTab('operations')}
          style={{
            background: activeTab === 'operations' ? 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))' : 'var(--color-surface)',
            color: activeTab === 'operations' ? 'white' : 'var(--color-text-secondary)',
            padding: '0.7rem 1.4rem',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            border: activeTab === 'operations' ? 'none' : '1px solid var(--color-border)',
            boxShadow: activeTab === 'operations' ? 'var(--shadow-glow)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <Camera size={18} /> Quét AI & Kệ Hàng
        </button>

        <button
          onClick={() => setActiveTab('catalog')}
          style={{
            background: activeTab === 'catalog' ? 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))' : 'var(--color-surface)',
            color: activeTab === 'catalog' ? 'white' : 'var(--color-text-secondary)',
            padding: '0.7rem 1.4rem',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            border: activeTab === 'catalog' ? 'none' : '1px solid var(--color-border)',
            boxShadow: activeTab === 'catalog' ? 'var(--shadow-glow)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <Layers size={18} /> Quản lý Danh mục ({catalogData?.data?.length || 0})
        </button>
      </div>

      {activeTab === 'catalog' && (
        <CatalogManager onRefreshParent={() => { mutate(); mutateCatalog(); }} />
      )}

      {activeTab === 'operations' && (
        <>
          <EcoDashboard view="merchant" />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
            {/* LEFT COL: INPUT */}
            <section className="glass-card" style={{ padding: '2rem' }}>
              <h2>Scanner</h2>
              <p style={{ marginBottom: '1.5rem', color: 'var(--color-text-secondary)' }}>Upload tray photo to analyze</p>
              
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleRealUpload} 
              />

              <div style={{ marginBottom: '2rem' }}>
                <button 
                  className="btn-primary" 
                  onClick={() => fileInputRef.current?.click()}
                  style={{ width: '100%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1rem' }}
                >
                  <Camera size={20} /> Chụp / Tải ảnh thật
                </button>
              </div>

              {isScanning && (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-primary)' }}>
                  <div className="pulse-glow" style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--color-primary-dark)', margin: '0 auto 1rem' }} />
                  <p>🤖 AI is scanning and analyzing...</p>
                </div>
              )}

              {aiResult && !isScanning && (() => {
                const matchedProduct = catalogData?.data?.find((p: any) => 
                  p.id === aiResult.productId || p.name?.toLowerCase() === aiResult.item_name?.toLowerCase()
                );
                const availableStock = matchedProduct?.stockQuantity ?? 0;
                const isOverStock = availableStock > 0 ? (aiResult.quantity > availableStock) : false;
                const isOutOfStock = availableStock <= 0;

                let catalogImg: string | null = null;
                if (matchedProduct?.sampleImages) {
                  try {
                    const parsed = JSON.parse(matchedProduct.sampleImages);
                    if (Array.isArray(parsed) && parsed.length > 0) catalogImg = parsed[0];
                    else catalogImg = matchedProduct.sampleImages;
                  } catch {
                    catalogImg = matchedProduct.sampleImages;
                  }
                }

                return (
                  <div style={{ background: 'var(--color-surface)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                    <h3 style={{ color: 'var(--color-primary-light)', marginBottom: '1rem' }}>✅ AI Phân tích thành công</h3>
                    
                    {/* KHỐI ẢNH ĐỐI CHIẾU: ẢNH CATALOG (TRONG DB) vs ẢNH CHỤP THỰC TẾ (LÊN STOREFRONT) */}
                    <div style={{ marginBottom: '1.2rem', display: 'grid', gridTemplateColumns: uploadedImage ? '1fr 1fr' : '1fr', gap: '0.8rem' }}>
                      {/* Ảnh trong Database */}
                      <div style={{ position: 'relative', height: '140px', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '2px solid var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {catalogImg ? (
                          <img src={catalogImg} alt="Catalog DB" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem', padding: '0.5rem' }}>
                            <Camera size={20} style={{ margin: '0 auto 0.2rem', opacity: 0.5 }} />
                            <span>Chưa có ảnh trong DB</span>
                          </div>
                        )}
                        <span style={{ position: 'absolute', bottom: '6px', left: '6px', right: '6px', background: 'rgba(15, 23, 42, 0.9)', color: 'var(--color-primary-light)', fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.4rem', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
                          📦 Ảnh mẫu Catalog (Trong DB)
                        </span>
                      </div>

                      {/* Ảnh chụp thực tế sẽ lên Storefront */}
                      {uploadedImage && (
                        <div style={{ position: 'relative', height: '140px', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px dashed var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img src={uploadedImage} alt="Real Scanned" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <span style={{ position: 'absolute', bottom: '6px', left: '6px', right: '6px', background: 'rgba(0, 0, 0, 0.85)', color: '#cbd5e1', fontSize: '0.7rem', padding: '0.2rem 0.4rem', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
                            📸 Ảnh thực tế (Lên Storefront)
                          </span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem' }}>Sản phẩm (Khớp với Catalog)</label>
                      <select 
                        value={aiResult.productId || matchedProduct?.id || ''} 
                        onChange={e => {
                          const selectedId = parseInt(e.target.value);
                          const selectedProduct = catalogData?.data?.find((p: any) => p.id === selectedId);
                          if (selectedProduct) {
                            setAiResult({
                              ...aiResult, 
                              productId: selectedProduct.id,
                              item_name: selectedProduct.name,
                              base_price: selectedProduct.basePrice,
                              min_price: selectedProduct.minPrice,
                              quantity: Math.min(aiResult.quantity || 1, Math.max(1, selectedProduct.stockQuantity || 1))
                            });
                          }
                        }}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'white' }}
                      >
                        <option value="" disabled>-- Chọn sản phẩm --</option>
                        {catalogData?.data?.map((p: any) => (
                          <option key={p.id} value={p.id}>{p.name} (Kho: {p.stockQuantity} | Gốc: {p.basePrice}đ)</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                          <label style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>Số lượng xả</label>
                          <span style={{ fontSize: '0.72rem', color: isOutOfStock ? '#f87171' : '#60a5fa', fontWeight: 600 }}>
                            Kho: {availableStock}
                          </span>
                        </div>
                        <input 
                          type="number" 
                          min="1"
                          max={availableStock > 0 ? availableStock : 1}
                          value={aiResult.quantity} 
                          onChange={e => setAiResult({...aiResult, quantity: parseInt(e.target.value) || 0})}
                          style={{ 
                            width: '100%', 
                            padding: '0.5rem', 
                            borderRadius: 'var(--radius-sm)', 
                            border: `1px solid ${isOverStock || isOutOfStock ? 'var(--color-error)' : 'var(--color-border)'}`, 
                            background: 'var(--color-bg)', 
                            color: 'white' 
                          }}
                        />
                        {isOutOfStock && (
                          <p style={{ color: '#fca5a5', fontSize: '0.7rem', margin: '0.2rem 0 0' }}>
                            ⚠️ Hết hàng trong kho (0).
                          </p>
                        )}
                        {!isOutOfStock && isOverStock && (
                          <p style={{ color: '#fca5a5', fontSize: '0.7rem', margin: '0.2rem 0 0' }}>
                            ⚠️ Tối đa có thể xả: {availableStock}.
                          </p>
                        )}
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem' }}>Giá gốc (VNĐ)</label>
                        <input 
                          type="number" 
                          value={aiResult.base_price} 
                          onChange={e => setAiResult({...aiResult, base_price: parseInt(e.target.value) || 0})}
                          style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'white' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem' }}>Giá sàn (VNĐ)</label>
                        <input 
                          type="number" 
                          value={aiResult.min_price} 
                          onChange={e => setAiResult({...aiResult, min_price: parseInt(e.target.value) || 0})}
                          style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'white' }}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ background: 'var(--color-bg)', padding: '1rem', borderRadius: 'var(--radius-sm)', borderLeft: '4px solid var(--color-primary)', marginBottom: '1.5rem' }}>
                    <p style={{ fontSize: '0.9rem', fontStyle: 'italic' }}>"{aiResult.ai_rationale}"</p>
                  </div>

                  <button 
                    className="btn-primary" 
                    onClick={handlePublish} 
                    disabled={isOutOfStock || isOverStock}
                    style={{ 
                      width: '100%', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      gap: '0.5rem',
                      opacity: (isOutOfStock || isOverStock) ? 0.5 : 1,
                      cursor: (isOutOfStock || isOverStock) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <UploadCloud size={18} /> Push to Storefront
                  </button>
                </div>
              );
            })()}
            </section>

            {/* RIGHT COL: ACTIVE INVENTORY */}
            <section className="glass-card" style={{ padding: '2rem' }}>
              <h2>Active Clearance</h2>
              <p style={{ marginBottom: '1.5rem', color: 'var(--color-text-secondary)' }}>Items currently on the storefront</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {itemsData?.data?.map((item: any) => {
                  const catalogProd = item.product || catalogData?.data?.find((p: any) => p.id === item.productId || p.name?.toLowerCase() === item.name?.toLowerCase());
                  const stockQty = catalogProd?.stockQuantity ?? 0;

                  return (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-text-primary)' }}>{item.name}</h4>
                        
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem', alignItems: 'center' }}>
                          {/* Số lượng đang xả trên kệ Storefront */}
                          <span style={{ 
                            background: 'rgba(16, 185, 129, 0.15)', 
                            color: 'var(--color-primary-light)', 
                            border: '1px solid var(--color-primary-dark)', 
                            padding: '0.15rem 0.5rem', 
                            borderRadius: 'var(--radius-sm)', 
                            fontSize: '0.75rem', 
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)' }} />
                            Đang xả: <strong>{item.currentQuantity}</strong> phần
                          </span>

                          {/* Số lượng tồn kho còn lại */}
                          <span style={{ 
                            background: stockQty > 0 ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)', 
                            color: stockQty > 0 ? '#60a5fa' : '#f87171', 
                            border: `1px solid ${stockQty > 0 ? 'rgba(59, 130, 246, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`, 
                            padding: '0.15rem 0.5rem', 
                            borderRadius: 'var(--radius-sm)', 
                            fontSize: '0.75rem',
                            fontWeight: 500
                          }}>
                            📦 Kho: <strong>{stockQty}</strong>
                          </span>

                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            Gốc: {item.originalPrice.toLocaleString('vi-VN')}đ
                          </span>
                        </div>
                      </div>

                      <button 
                        onClick={() => handleStop(item.id)}
                        style={{ background: 'var(--color-error)', color: 'white', padding: '0.45rem 0.85rem', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                      >
                        Dừng xả kho
                      </button>
                    </div>
                  );
                })}
                {!itemsData?.data?.length && <p style={{ color: 'var(--color-text-muted)' }}>Kho trống.</p>}
              </div>
            </section>
          </div>

          {/* BOTTOM ROW: ORDERS KANBAN */}
          <section className="glass-card" style={{ padding: '2rem', marginTop: '2rem' }}>
            <h2>Live Orders Kanban</h2>
            <p style={{ marginBottom: '1.5rem', color: 'var(--color-text-secondary)' }}>Manage customer pickups in real-time</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {ordersData?.data?.filter((o: any) => o.status === 'PENDING').map((order: any) => {
                const timeLeft = order.expiresAt ? Math.max(0, Math.floor((new Date(order.expiresAt).getTime() - Date.now()) / 60000)) : 0;
                return (
                  <div key={order.id} style={{ background: 'var(--color-surface)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{order.pickupCode}</span>
                      <span style={{ color: timeLeft > 5 ? 'var(--color-warning)' : 'var(--color-error)', fontSize: '0.9rem' }}>
                        ⏳ Còn {timeLeft} phút
                      </span>
                    </div>
                    <h3 style={{ margin: '0.5rem 0' }}>{order.customerName}</h3>
                    <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                      {order.clearanceItem?.name} (x{order.quantity}) - {order.lockedPrice.toLocaleString('vi-VN')}đ
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => handleOrderAction(order.id, 'COMPLETED')} className="btn-primary" style={{ flex: 1, background: 'var(--color-success)' }}>✅ Đã thanh toán</button>
                      <button onClick={() => handleOrderAction(order.id, 'CANCELLED')} className="btn-primary" style={{ flex: 1, background: 'var(--color-error)' }}>❌ Khách không đến</button>
                    </div>
                  </div>
                );
              })}
              {(!ordersData?.data || ordersData.data.filter((o: any) => o.status === 'PENDING').length === 0) && (
                <p style={{ color: 'var(--color-text-muted)' }}>Chưa có đơn đặt chỗ nào.</p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

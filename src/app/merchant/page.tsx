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
    
    // Override the lowest price in the decay schedule
    const finalDecaySchedule = [...(aiResult.decay_schedule || [])];
    if (finalDecaySchedule.length > 0) {
      finalDecaySchedule.sort((a, b) => b.minutes_before_close - a.minutes_before_close);
      finalDecaySchedule[finalDecaySchedule.length - 1].price = aiResult.min_price;
    }

    await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: aiResult.item_name,
        quantity: aiResult.quantity,
        originalPrice: aiResult.base_price,
        imageUrl: uploadedImage,
        aiPricingStrategy: { decay_schedule: finalDecaySchedule },
        aiRationale: aiResult.ai_rationale
      })
    });

    setAiResult(null);
    setUploadedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    mutate(); // Refresh list
  };

  const handleStop = async (id: number) => {
    await fetch(`/api/items/${id}`, { method: 'DELETE' });
    mutate(); // Refresh list immediately
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

              {aiResult && !isScanning && (
                <div style={{ background: 'var(--color-surface)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                  <h3 style={{ color: 'var(--color-primary-light)', marginBottom: '1rem' }}>✅ AI Phân tích thành công</h3>
                  
                  {uploadedImage && (
                    <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
                      <img src={uploadedImage} alt="Scanned item" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: 'var(--radius-sm)', objectFit: 'cover' }} />
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem' }}>Sản phẩm (Khớp với Catalog)</label>
                      <select 
                        value={aiResult.productId || ''} 
                        onChange={e => {
                          const selectedId = parseInt(e.target.value);
                          const selectedProduct = catalogData?.data?.find((p: any) => p.id === selectedId);
                          if (selectedProduct) {
                            setAiResult({
                              ...aiResult, 
                              productId: selectedProduct.id,
                              item_name: selectedProduct.name,
                              base_price: selectedProduct.basePrice,
                              min_price: selectedProduct.minPrice
                            });
                          }
                        }}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'white' }}
                      >
                        <option value="" disabled>-- Chọn sản phẩm --</option>
                        {catalogData?.data?.map((p: any) => (
                          <option key={p.id} value={p.id}>{p.name} (Gốc: {p.basePrice}đ)</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem' }}>Số lượng</label>
                        <input 
                          type="number" 
                          value={aiResult.quantity} 
                          onChange={e => setAiResult({...aiResult, quantity: parseInt(e.target.value) || 0})}
                          style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'white' }}
                        />
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

                  <button className="btn-primary" onClick={handlePublish} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <UploadCloud size={18} /> Push to Storefront
                  </button>
                </div>
              )}
            </section>

            {/* RIGHT COL: ACTIVE INVENTORY */}
            <section className="glass-card" style={{ padding: '2rem' }}>
              <h2>Active Clearance</h2>
              <p style={{ marginBottom: '1.5rem', color: 'var(--color-text-secondary)' }}>Items currently on the storefront</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {itemsData?.data?.map((item: any) => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
                    <div>
                      <h4 style={{ margin: 0 }}>{item.name}</h4>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Kho: {item.currentQuantity} | Gốc: {item.originalPrice}đ</span>
                    </div>
                    <button 
                      onClick={() => handleStop(item.id)}
                      style={{ background: 'var(--color-error)', color: 'white', padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}
                    >
                      Dừng xả kho
                    </button>
                  </div>
                ))}
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

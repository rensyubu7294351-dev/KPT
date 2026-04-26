import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Download, Edit2, Trash2, X, ChevronLeft, ChevronRight,
  Calendar, User, Filter, Image, Video, Loader2,
  AlertCircle, Play, ZoomIn
} from 'lucide-react';
import { db } from './firebase';
import {
  collection, onSnapshot,
  addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy
} from 'firebase/firestore';

// =========================================================
// ★ Cloudinary設定（ここを自分の情報に書き換えてください）
// =========================================================
const CLOUDINARY_CONFIG = {
  cloudName:    'dwwduejls',      // ← STEP3でメモしたCloud Name
  uploadPreset: 'test729',  // ← STEP2で作ったPreset name
};
const CLOUDINARY_UPLOAD_URL =
  `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/auto/upload`;

const MAX_IMAGE_SIZE_MB = 10;
const MAX_VIDEO_SIZE_MB = 100;
const MAX_MEDIA_COUNT   = 5;

// =========================================================
// 定数
// =========================================================
const KPT_TYPES   = ['Keep', 'Problem', 'Try'];
const DEPARTMENTS = ['運営スタッフ', '練習部', 'はっぱ隊', '衣装', '演舞制作', 'その他'];
const MONTHS      = Array.from({ length: 12 }, (_, i) => i + 1);
const KOMAS       = [1, 2, 3, 4];

const KOMA_LABELS = { 1: '第1コマ', 2: '第2コマ', 3: '第3コマ', 4: '第4コマ' };

const KPT_BADGE_COLORS = {
  Keep:    'bg-blue-100 text-blue-700 border border-blue-200',
  Problem: 'bg-red-100 text-red-700 border border-red-200',
  Try:     'bg-green-100 text-green-700 border border-green-200',
};
const KPT_CARD_BGS = {
  Keep:    'bg-blue-50/60',
  Problem: 'bg-red-50/60',
  Try:     'bg-green-50/60',
};
const KPT_MODAL_BTN_COLORS = {
  Keep:    'bg-blue-600 text-white border-blue-600',
  Problem: 'bg-red-500 text-white border-red-500',
  Try:     'bg-green-500 text-white border-green-500',
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

// =========================================================
// Cloudinaryアップロード
// =========================================================
const uploadToCloudinary = async (file) => {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
  fd.append('folder', 'yosakoi-kpt');
  const res = await fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'アップロードに失敗しました');
  }
  const data = await res.json();
  const thumbnailUrl = data.resource_type === 'video'
    ? data.secure_url.replace('/upload/', '/upload/so_0,w_400,c_fill/').replace(/\.\w+$/, '.jpg')
    : null;
  return {
    publicId: data.public_id, url: data.secure_url, thumbnailUrl,
    resourceType: data.resource_type, format: data.format, bytes: data.bytes,
  };
};

// =========================================================
// MediaLightbox
// =========================================================
const MediaLightbox = ({ items, startIndex, onClose }) => {
  const [current, setCurrent] = useState(startIndex);
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape')     onClose();
      if (e.key === 'ArrowRight') setCurrent(c => Math.min(items.length - 1, c + 1));
      if (e.key === 'ArrowLeft')  setCurrent(c => Math.max(0, c - 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [items, onClose]);

  const item = items[current];
  if (!item) return null;
  return (
    <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full bg-white/10 z-10"><X size={24} /></button>
      {items.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm bg-black/40 px-3 py-1 rounded-full">
          {current + 1} / {items.length}
        </div>
      )}
      <div className="max-w-4xl max-h-[80dvh] w-full px-4" onClick={e => e.stopPropagation()}>
        {item.resourceType === 'video'
          ? <video src={item.url} controls autoPlay className="w-full max-h-[80dvh] rounded-xl" />
          : <img src={item.url} alt="" className="w-full max-h-[80dvh] object-contain rounded-xl" />
        }
      </div>
      {items.length > 1 && (
        <>
          <button onClick={e => { e.stopPropagation(); setCurrent(c => Math.max(0, c - 1)); }} disabled={current === 0}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white p-3 rounded-full bg-black/40 hover:bg-black/60 disabled:opacity-20 transition">
            <ChevronLeft size={24} />
          </button>
          <button onClick={e => { e.stopPropagation(); setCurrent(c => Math.min(items.length - 1, c + 1)); }} disabled={current === items.length - 1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white p-3 rounded-full bg-black/40 hover:bg-black/60 disabled:opacity-20 transition">
            <ChevronRight size={24} />
          </button>
        </>
      )}
      {items.length > 1 && (
        <div className="absolute bottom-4 flex gap-2 overflow-x-auto max-w-[90vw] px-2">
          {items.map((it, i) => (
            <button key={i} onClick={e => { e.stopPropagation(); setCurrent(i); }}
              className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition ${i === current ? 'border-white' : 'border-transparent opacity-60'}`}>
              {it.resourceType === 'video'
                ? <div className="w-full h-full bg-slate-700 flex items-center justify-center"><Play size={16} className="text-white" /></div>
                : <img src={it.url} alt="" className="w-full h-full object-cover" />
              }
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// =========================================================
// MediaUploader
// =========================================================
const MediaUploader = ({ mediaItems, onMediaChange }) => {
  const [uploading, setUploading] = useState([]);
  const [errors,    setErrors]    = useState([]);
  const fileInputRef              = useRef(null);
  const isDemoMode                = CLOUDINARY_CONFIG.cloudName === 'YOUR_CLOUD_NAME';

  const handleFiles = useCallback(async (files) => {
    setErrors([]);
    const fileArray = Array.from(files);
    const remaining = MAX_MEDIA_COUNT - mediaItems.length;
    if (remaining <= 0) { setErrors([`最大${MAX_MEDIA_COUNT}ファイルまでです`]); return; }
    const toUpload  = fileArray.slice(0, remaining);
    const newErrors = [];
    const validFiles = toUpload.filter(file => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (!isImage && !isVideo) { newErrors.push(`${file.name}：画像・動画のみ対応`); return false; }
      const maxMB = isVideo ? MAX_VIDEO_SIZE_MB : MAX_IMAGE_SIZE_MB;
      if (file.size > maxMB * 1024 * 1024) { newErrors.push(`${file.name}：${maxMB}MB以下にしてください`); return false; }
      return true;
    });
    setErrors(newErrors);
    if (validFiles.length === 0) return;
    if (isDemoMode) {
      onMediaChange([...mediaItems, ...validFiles.map(file => ({
        publicId: generateId(), url: URL.createObjectURL(file), thumbnailUrl: null,
        resourceType: file.type.startsWith('video/') ? 'video' : 'image',
        format: file.name.split('.').pop(), bytes: file.size, isLocalPreview: true,
      }))]);
      return;
    }
    setUploading(validFiles.map(f => f.name));
    const uploaded = [];
    for (const file of validFiles) {
      try { uploaded.push(await uploadToCloudinary(file)); }
      catch (e) { newErrors.push(`${file.name}：${e.message}`); }
    }
    setUploading([]);
    if (newErrors.length > 0) setErrors(prev => [...prev, ...newErrors]);
    if (uploaded.length > 0)  onMediaChange([...mediaItems, ...uploaded]);
  }, [mediaItems, onMediaChange, isDemoMode]);

  const onDropMedia = (e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); };

  return (
    <div className="space-y-3">
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
        画像・動画（任意・最大{MAX_MEDIA_COUNT}枚）
      </label>
      {isDemoMode && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          <div><b>デモモード：</b>プレビューのみで保存されません。<br />本番利用前に <code className="bg-amber-100 px-1 rounded">CLOUDINARY_CONFIG</code> を設定してください。</div>
        </div>
      )}
      {mediaItems.length < MAX_MEDIA_COUNT && (
        <div onDrop={onDropMedia} onDragOver={e => e.preventDefault()} onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-200 rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-slate-400 hover:bg-slate-50 active:bg-slate-100 transition-colors text-center select-none">
          <div className="flex gap-3 text-slate-300"><Image size={28} /><Video size={28} /></div>
          <p className="text-sm font-medium text-slate-500">タップして選択<span className="hidden sm:inline"> またはドラッグ＆ドロップ</span></p>
          <p className="text-xs text-slate-400">画像（最大{MAX_IMAGE_SIZE_MB}MB）・動画（最大{MAX_VIDEO_SIZE_MB}MB）</p>
          <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden"
            onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />
        </div>
      )}
      {uploading.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 rounded-xl px-4 py-3">
          <Loader2 size={16} className="animate-spin flex-shrink-0" />
          <span>{uploading.length}件をCloudinaryにアップロード中...</span>
        </div>
      )}
      {errors.length > 0 && (
        <div className="space-y-1">
          {errors.map((err, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle size={12} className="flex-shrink-0 mt-0.5" /><span>{err}</span>
            </div>
          ))}
        </div>
      )}
      {mediaItems.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {mediaItems.map((item, i) => (
            <div key={i} className="relative group rounded-xl overflow-hidden bg-slate-100 aspect-square">
              {item.resourceType === 'video' ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 gap-1">
                  {item.thumbnailUrl && <img src={item.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                  <div className="relative z-10 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center"><Play size={16} className="text-white" /></div>
                  <span className="relative z-10 text-white text-[10px] font-medium">動画</span>
                </div>
              ) : (
                <img src={item.url} alt="" className="w-full h-full object-cover" />
              )}
              <button type="button" onClick={() => onMediaChange(mediaItems.filter((_, idx) => idx !== i))}
                className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity z-20 hover:bg-red-600">
                <X size={12} />
              </button>
              {item.isLocalPreview && (
                <div className="absolute bottom-1 left-1 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md z-20">未保存</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// =========================================================
// MediaPreview
// =========================================================
const MediaPreview = ({ items }) => {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  if (!items || items.length === 0) return null;
  const display     = items.slice(0, 4);
  const remainCount = items.length - 4;
  return (
    <>
      <div className={`grid gap-1 mb-3 ${display.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {display.map((item, i) => {
          const showOverlay = i === display.length - 1 && remainCount > 0;
          return (
            <div key={i} onClick={() => setLightboxIndex(i)}
              className="relative rounded-lg overflow-hidden bg-slate-200 cursor-pointer group"
              style={{ aspectRatio: display.length === 1 ? '16/9' : '1/1' }}>
              {item.resourceType === 'video' ? (
                <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                  {item.thumbnailUrl && <img src={item.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                  <div className="relative z-10 w-8 h-8 bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:bg-white/50 transition">
                    <Play size={14} className="text-white" />
                  </div>
                </div>
              ) : (
                <>
                  <img src={item.url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition flex items-center justify-center">
                    <ZoomIn size={16} className="text-white opacity-0 group-hover:opacity-100 transition" />
                  </div>
                </>
              )}
              {showOverlay && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                  <span className="text-white font-bold text-lg">+{remainCount}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {lightboxIndex !== null && (
        <MediaLightbox items={items} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </>
  );
};

// =========================================================
// NoteModal
// =========================================================
const NoteModal = ({ isOpen, onClose, onSave, initialData }) => {
  const [formData, setFormData] = useState({
    id: '', type: 'Keep', month: 1, koma: 1,
    department: '運営スタッフ', content: '', author: '', mediaItems: [],
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        id: '', type: 'Keep', month: 1, koma: 1,
        department: '運営スタッフ', content: '', author: '', mediaItems: [],
        ...(initialData || {}),
      });
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: (name === 'month' || name === 'koma') ? Number(value) : value }));
  };

  // =========================================================
  // ★ バグ修正①: モーダルが閉じない問題
  //   handleSubmitがasyncでないためFirestore保存完了を待てずモーダルが
  //   閉じなかった。onSaveをawaitで待つように修正。
  // =========================================================
  const handleSubmit = async () => {
    if (!formData.content.trim() || !formData.author.trim()) return;
    await onSave(formData); // ← awaitを追加
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[95dvh] sm:max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-slate-200" />
        </div>
        <div className="flex justify-between items-center px-5 py-3 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-base font-bold text-slate-800">{formData.id ? '付箋を編集' : '新しい付箋を貼る'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"><X size={20} /></button>
        </div>
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">種類 (KPT)</label>
            <div className="flex gap-2">
              {KPT_TYPES.map(type => (
                <button key={type} type="button" onClick={() => setFormData(prev => ({ ...prev, type }))}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border-2 ${formData.type === type ? KPT_MODAL_BTN_COLORS[type] : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'}`}>
                  {type}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '月',  name: 'month',      options: MONTHS.map(m => ({ value: m, label: `${m}月` })) },
              { label: 'コマ', name: 'koma',       options: KOMAS.map(k => ({ value: k, label: KOMA_LABELS[k] })) },
              { label: '部門', name: 'department', options: DEPARTMENTS.map(d => ({ value: d, label: d })) },
            ].map(({ label, name, options }) => (
              <div key={name}>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
                <select name={name} value={formData[name]} onChange={handleChange}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400">
                  {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">内容</label>
            <textarea name="content" value={formData.content} onChange={handleChange}
              placeholder="良かったこと、問題点、次に挑戦したいことを入力してください..."
              rows={4} required
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-base text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none leading-relaxed" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">入力者</label>
            <input type="text" name="author" value={formData.author} onChange={handleChange}
              placeholder="あなたのお名前" required
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-base text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400" />
          </div>
          <MediaUploader
            mediaItems={formData.mediaItems || []}
            onMediaChange={(items) => setFormData(prev => ({ ...prev, mediaItems: items }))}
          />
        </div>
        <div className="px-5 pb-6 pt-3 flex gap-3 border-t border-slate-100 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="flex-1 py-3.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
            キャンセル
          </button>
          <button type="button" onClick={handleSubmit}
            disabled={!formData.content.trim() || !formData.author.trim()}
            className="flex-1 py-3.5 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-700 transition-colors shadow-md disabled:opacity-40 disabled:cursor-not-allowed">
            ボードに貼る
          </button>
        </div>
      </div>
    </div>
  );
};

// =========================================================
// NoteCard
// =========================================================
const NoteCard = ({ note, onEdit, onDelete, onDragStart }) => {
  const mediaCount = note.mediaItems?.length || 0;

  // =========================================================
  // ★ バグ修正②: ゴミ箱ボタンが押せない問題
  //   draggableな親要素のイベントがボタンのclickを横取りしていた。
  //   e.stopPropagation()を追加して親へのイベント伝播を止める。
  // =========================================================
  const handleEdit = (e) => {
    e.stopPropagation();
    onEdit(note);
  };
  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete(note.id);
  };

  return (
    <div draggable onDragStart={(e) => onDragStart(e, note.id)} onDragEnd={(e) => e.currentTarget.style.opacity = '1'}
      className={`group relative p-3.5 rounded-xl cursor-grab active:cursor-grabbing mb-2.5 border border-slate-100 shadow-sm ${KPT_CARD_BGS[note.type]} transition-shadow hover:shadow-md`}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-1.5">
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${KPT_BADGE_COLORS[note.type]}`}>{note.type}</span>
          {mediaCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-slate-500 bg-white/80 px-1.5 py-0.5 rounded-md border border-slate-100">
              <Image size={10} /><span>{mediaCount}</span>
            </span>
          )}
        </div>
        {/* ★ ボタンを常に表示・サイズを大きくしてタップしやすく */}
        <div className="flex gap-1">
          <button
            onClick={handleEdit}
            className="text-slate-400 hover:text-slate-700 p-2 bg-white/90 rounded-lg shadow-sm active:scale-95 active:bg-slate-100 transition-all touch-manipulation"
          >
            <Edit2 size={15} />
          </button>
          <button
            onClick={handleDelete}
            className="text-slate-400 hover:text-red-600 p-2 bg-white/90 rounded-lg shadow-sm active:scale-95 active:bg-red-50 transition-all touch-manipulation"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <MediaPreview items={note.mediaItems} />
      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed mb-3">{note.content}</p>
      <div className="flex justify-between items-center text-xs text-slate-500">
        <span className="font-medium bg-white/70 px-2 py-0.5 rounded-md">{note.department}</span>
        <div className="flex items-center gap-1">
          <User size={11} className="text-slate-400" /><span>{note.author}</span>
        </div>
      </div>
    </div>
  );
};

// =========================================================
// メインコンポーネント: App
// =========================================================
export default function App() {

  const [notes,        setNotes]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filterDept,   setFilterDept]   = useState('All');
  const [filterType,   setFilterType]   = useState('All');
  const [isModalOpen,  setIsModalOpen]  = useState(false);
  const [editingNote,  setEditingNote]  = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth() + 1);
  const [isDesktop,    setIsDesktop]    = useState(() => window.innerWidth >= 768);

  useEffect(() => {
    const q = query(collection(db, 'notes'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setNotes(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const h = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const handleSaveNote = async (noteData) => {
    if (noteData.id) {
      const { id, ...dataToSave } = noteData;
      await updateDoc(doc(db, 'notes', id), { ...dataToSave, updatedAt: serverTimestamp() });
    } else {
      const { id, ...dataToSave } = noteData;
      await addDoc(collection(db, 'notes'), {
        ...dataToSave,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    setIsModalOpen(false);
    setEditingNote(null);
  };

  const handleDeleteNote = async (id) => {
    if (window.confirm('この付箋を削除してもよろしいですか？')) {
      await deleteDoc(doc(db, 'notes', id));
    }
  };

  const openModal = (note = null) => { setEditingNote(note); setIsModalOpen(true); };

  const onDragStart = (e, id) => { e.dataTransfer.setData('noteId', id); e.currentTarget.style.opacity = '0.5'; };
  const onDragOver  = (e) => { e.preventDefault(); e.currentTarget.classList.add('bg-blue-50'); };
  const onDragLeave = (e) => { e.currentTarget.classList.remove('bg-blue-50'); };
  const onDrop = async (e, month, koma) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-blue-50');
    const noteId = e.dataTransfer.getData('noteId');
    if (noteId) {
      await updateDoc(doc(db, 'notes', noteId), { month, koma, updatedAt: serverTimestamp() });
    }
  };

  const exportCSV = () => {
    const sorted = [...notes].sort((a, b) => a.month !== b.month ? a.month - b.month : a.koma - b.koma);
    const headers = ['ID', '種別', '月', 'コマ', '部門', '入力者', '内容', 'メディア数', 'メディアURL'];
    const rows = sorted.map(n => {
      const urls = (n.mediaItems || []).map(m => m.url).join(' | ');
      return `"${n.id}","${n.type}","${n.month}月","${KOMA_LABELS[n.koma]}","${n.department}","${n.author.replace(/"/g,'""')}","${n.content.replace(/"/g,'""')}","${(n.mediaItems||[]).length}","${urls}"`;
    });
    const csv  = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([new Uint8Array([0xEF,0xBB,0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: `yosakoi-kpt-${new Date().toISOString().split('T')[0]}.csv` });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredNotes     = notes.filter(n =>
    (filterDept === 'All' || n.department === filterDept) &&
    (filterType === 'All' || n.type === filterType)
  );
  const activeFilterCount = (filterDept !== 'All' ? 1 : 0) + (filterType !== 'All' ? 1 : 0);

  if (loading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          <p className="text-sm">読み込み中...</p>
        </div>
      </div>
    );
  }

  // ---- スマホ: 月別縦スクロールビュー ----
  const MobileMonthView = ({ month }) => (
    <div className="flex flex-col gap-3 pb-24">
      {KOMAS.map(koma => {
        const komaNotes = filteredNotes.filter(n => n.month === month && n.koma === koma);
        return (
          <div key={koma} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{KOMA_LABELS[koma]}</span>
              <span className="text-xs text-slate-400">{komaNotes.length}枚</span>
            </div>
            <div className="p-3">
              {komaNotes.map(note => (
                <NoteCard key={note.id} note={note} onEdit={() => openModal(note)} onDelete={handleDeleteNote} onDragStart={onDragStart} />
              ))}
              <button onClick={() => openModal({ month, koma })}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-slate-400 hover:text-slate-600 active:bg-slate-50 transition-colors text-sm font-medium">
                <Plus size={16} /><span>付箋を追加</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  // ---- PC: 横スクロールボード ----
  const DesktopBoard = () => (
    <main className="flex-1 overflow-x-auto overflow-y-hidden p-4 flex gap-4 items-start" style={{ scrollbarWidth: 'thin' }}>
      {MONTHS.map(month => {
        const count = filteredNotes.filter(n => n.month === month).length;
        return (
          <div key={month} className="flex-shrink-0 w-[280px] h-full flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="h-10 bg-slate-800 text-white flex items-center justify-between px-4">
              <span className="font-bold text-base">{month}月</span>
              <span className="text-xs text-slate-300">{count}枚</span>
            </div>
            <div className="flex-1 flex flex-col overflow-y-auto p-2" style={{ scrollbarWidth: 'thin' }}>
              {KOMAS.map((koma, index) => {
                const komaNotes = filteredNotes.filter(n => n.month === month && n.koma === koma);
                return (
                  <div key={koma}
                    className={`flex flex-col min-h-[80px] transition-colors rounded-lg p-1 ${index < KOMAS.length - 1 ? 'border-b border-dashed border-slate-200 mb-2 pb-2' : ''}`}
                    onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={(e) => onDrop(e, month, koma)}
                    onDoubleClick={() => openModal({ month, koma })}>
                    {komaNotes.map(note => (
                      <NoteCard key={note.id} note={note} onEdit={() => openModal(note)} onDelete={handleDeleteNote} onDragStart={onDragStart} />
                    ))}
                    {komaNotes.length === 0 && (
                      <div className="flex-1 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer py-4" onClick={() => openModal({ month, koma })}>
                        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 hover:bg-slate-100 hover:text-slate-400 transition-colors border border-slate-100">
                          <Plus size={20} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </main>
  );

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-slate-50 font-sans text-slate-800 overflow-hidden">

      {/* ヘッダー */}
      <header className="flex-shrink-0 bg-white border-b border-slate-200 z-30">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="bg-slate-800 p-1.5 rounded-lg text-white"><Calendar size={18} /></div>
            <div>
              <h1 className="text-base font-bold text-slate-800 leading-tight">よさこいサークル</h1>
              <p className="text-xs text-blue-600 font-semibold leading-tight">年間KPTボード</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsFilterOpen(p => !p)}
              className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 active:bg-slate-100 transition-colors">
              <Filter size={15} />
              <span className="hidden sm:inline">絞り込み</span>
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{activeFilterCount}</span>
              )}
            </button>
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 active:bg-slate-100 transition-colors">
              <Download size={15} /><span className="hidden sm:inline">CSV</span>
            </button>
            {/* ★ PC用追加ボタン */}
            <button onClick={() => openModal()}
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-700 transition-colors">
              <Plus size={16} /><span>付箋を追加</span>
            </button>
          </div>
        </div>

        {/* スマホ月ナビ */}
        {!isDesktop && (
          <div className="flex items-center gap-2 px-4 pb-3">
            <button onClick={() => setCurrentMonth(m => Math.max(1, m - 1))} disabled={currentMonth === 1}
              className="p-2 rounded-xl border border-slate-200 text-slate-500 disabled:opacity-30 active:bg-slate-100 transition-colors">
              <ChevronLeft size={18} />
            </button>
            <div className="flex-1 flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {MONTHS.map(m => (
                <button key={m} onClick={() => setCurrentMonth(m)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-sm font-bold transition-colors ${m === currentMonth ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {m}月
                </button>
              ))}
            </div>
            <button onClick={() => setCurrentMonth(m => Math.min(12, m + 1))} disabled={currentMonth === 12}
              className="p-2 rounded-xl border border-slate-200 text-slate-500 disabled:opacity-30 active:bg-slate-100 transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </header>

      {/* PC フィルタパネル */}
      {isDesktop && isFilterOpen && (
        <div className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-3 flex gap-3 z-20">
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400">
            <option value="All">すべての部門</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400">
            <option value="All">すべてのKPT</option>
            {KPT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      )}

      {/* メインコンテンツ */}
      {isDesktop ? <DesktopBoard /> : (
        <main className="flex-1 overflow-y-auto px-3 pt-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-800">{currentMonth}月</h2>
            <span className="text-xs text-slate-500 bg-slate-200 px-2.5 py-1 rounded-full font-medium">
              {filteredNotes.filter(n => n.month === currentMonth).length}枚
            </span>
          </div>
          <MobileMonthView month={currentMonth} />
        </main>
      )}

      {/* =========================================================
          ★ バグ修正③: FABボタンが右上に来てしまう問題
             isDesktopの条件を外してスマホ・PC両方で
             fixed bottom-6 right-5 で右下固定に変更
             PCでは「付箋を追加」ボタンがヘッダーにあるので
             FABはスマホのみ表示のままにする
          ========================================================= */}
      {!isDesktop && (
        <button
          onClick={() => openModal({ month: currentMonth, koma: 1 })}
          className="fixed bottom-6 right-5 z-50 w-14 h-14 rounded-full bg-slate-900 text-white shadow-xl flex items-center justify-center active:scale-95 transition-all touch-manipulation"
          aria-label="付箋を追加"
          style={{ position: 'fixed', bottom: '24px', right: '20px' }}
        >
          <Plus size={26} />
        </button>
      )}

      {/* スマホ フィルタシート */}
      {!isDesktop && isFilterOpen && (
        <div className="fixed inset-0 bg-slate-900/40 z-40 flex items-end" onClick={() => setIsFilterOpen(false)}>
          <div className="bg-white w-full rounded-t-2xl p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center mb-4"><div className="w-10 h-1.5 rounded-full bg-slate-200" /></div>
            <p className="text-sm font-bold text-slate-700 mb-4">絞り込み</p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1 font-semibold">部門</label>
                <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-base text-slate-700 focus:outline-none">
                  <option value="All">すべての部門</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1 font-semibold">KPT種別</label>
                <select value={filterType} onChange={e => setFilterType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-base text-slate-700 focus:outline-none">
                  <option value="All">すべてのKPT</option>
                  {KPT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setFilterDept('All'); setFilterType('All'); }}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-slate-600 bg-slate-100">リセット</button>
              <button onClick={() => setIsFilterOpen(false)}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-slate-900">適用する</button>
            </div>
          </div>
        </div>
      )}

      {/* 付箋モーダル */}
      <NoteModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingNote(null); }}
        onSave={handleSaveNote}
        initialData={editingNote}
      />
    </div>
  );
}
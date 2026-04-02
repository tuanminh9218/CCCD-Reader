import React, { useState, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { 
  Upload, 
  FileText, 
  User, 
  Calendar, 
  MapPin, 
  Home, 
  CreditCard, 
  Loader2, 
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import { CCCDInfo } from './types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CCCDInfo[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newImages: string[] = [];
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImages(prev => [...prev, reader.result as string]);
          setError(null);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const validateIdNumber = (id: string) => {
    if (!id) return "";
    const cleanId = id.replace(/\s/g, '');
    if (!/^\d+$/.test(cleanId)) return "Số CCCD chỉ được chứa chữ số";
    if (cleanId.length !== 12 && cleanId.length !== 9) return "Số CCCD phải có 9 hoặc 12 chữ số";
    return "";
  };

  const validateDate = (date: string) => {
    if (!date) return "";
    // Match DD/MM/YYYY
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = date.match(dateRegex);
    if (!match) return "Định dạng ngày phải là DD/MM/YYYY";

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);

    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
      return "Ngày không hợp lệ";
    }
    return "";
  };

  const extractInfo = async () => {
    if (images.length === 0) return;

    setLoading(true);
    setError(null);
    setFieldErrors({});

    try {
      const imageParts = images.map(img => ({
        inlineData: {
          mimeType: "image/jpeg",
          data: img.split(',')[1],
        },
      }));
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              ...imageParts,
              {
                text: `Hãy trích xuất thông tin từ các ảnh Căn cước công dân (CCCD) này. 
                Bạn có thể nhận được 1 hoặc 2 ảnh (mặt trước và mặt sau). 
                Hãy tổng hợp thông tin từ tất cả các ảnh được cung cấp.
                
                QUY TẮC ĐỊNH DẠNG:
                - idNumber: Số CCCD (thường ở mặt trước), chỉ lấy chữ số.
                - issueDate: Ngày cấp, định dạng DD/MM/YYYY.
                - fullName: Họ và tên (Viết IN HOA).
                - dateOfBirth: Ngày sinh, định dạng DD/MM/YYYY.
                - hometown: Quê quán.
                - permanentResidence: Nơi thường trú.
                
                Nếu không tìm thấy thông tin nào, hãy để trống chuỗi đó.`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              idNumber: { type: Type.STRING },
              issueDate: { type: Type.STRING },
              fullName: { type: Type.STRING },
              dateOfBirth: { type: Type.STRING },
              hometown: { type: Type.STRING },
              permanentResidence: { type: Type.STRING },
            },
            required: ["idNumber", "issueDate", "fullName", "dateOfBirth", "hometown", "permanentResidence"],
          },
        },
      });

      const result = JSON.parse(response.text || "{}") as CCCDInfo;
      
      // Validate fields
      const errors: Record<string, string> = {};
      const idError = validateIdNumber(result.idNumber);
      if (idError) errors.idNumber = idError;

      const dobError = validateDate(result.dateOfBirth);
      if (dobError) errors.dateOfBirth = dobError;

      const issueError = validateDate(result.issueDate);
      if (issueError) errors.issueDate = issueError;

      setFieldErrors(errors);
      setResults(prev => [...prev, result]);
      setImages([]); // Clear images after successful extraction to prepare for next one
    } catch (err) {
      console.error("Extraction error:", err);
      setError("Không thể đọc được thông tin từ ảnh. Vui lòng thử lại với ảnh rõ nét hơn.");
    } finally {
      setLoading(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const reset = () => {
    setImages([]);
    setResults([]);
    setFieldErrors({});
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatResultLine = (item: CCCDInfo) => {
    return `${item.idNumber} (${item.issueDate}) - ${item.fullName} - ${item.dateOfBirth} - ${item.hometown} - ${item.permanentResidence}`;
  };

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(index);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <CreditCard className="text-white w-5 h-5" />
            </div>
            <h1 className="font-bold text-lg tracking-tight">CCCD Reader AI</h1>
          </div>
          {images.length > 0 && (
            <button 
              onClick={reset}
              className="text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1 text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              Làm mới
            </button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Upload & Preview (Reduced Size) */}
          <section className="lg:col-span-4 space-y-6">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">Tải ảnh lên</h2>
              
              <div className="space-y-3">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all group"
                  style={{ width: '200px', height: '80px' }}
                >
                  <div className="bg-slate-100 p-2 rounded-full group-hover:bg-blue-100 transition-colors">
                    <Upload className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-slate-700 text-xs">Tải ảnh lên</p>
                    <p className="text-[9px] text-slate-400 mt-0.5 uppercase font-bold tracking-tight">Chọn nhiều ảnh</p>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    multiple
                    className="hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <AnimatePresence>
                    {images.map((img, index) => (
                      <motion.div 
                        key={index}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100 aspect-[1.58/1] group shadow-sm"
                      >
                        <img 
                          src={img} 
                          alt={`CCCD Preview ${index + 1}`} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <button 
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white p-0.5 rounded-full backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                        <div className="absolute bottom-1 left-1 bg-black/40 text-white text-[8px] px-1 py-0.5 rounded backdrop-blur-sm">
                          #{index + 1}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              {images.length > 0 && !loading && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={extractInfo}
                  className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl shadow-md shadow-blue-200 transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <FileText className="w-4 h-4" />
                  Trích xuất ngay
                </motion.button>
              )}

              {loading && (
                <div className="mt-4 flex flex-col items-center gap-2 py-2">
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                  <p className="text-[10px] font-bold text-slate-500 animate-pulse uppercase tracking-wider">Đang phân tích...</p>
                </div>
              )}

              {error && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl flex gap-2 text-red-700 text-[10px] font-medium"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p>{error}</p>
                </motion.div>
              )}
            </div>
          </section>

          {/* Right Column: History Table */}
          <section className="lg:col-span-8 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-full flex flex-col overflow-hidden" style={{ width: '800px' }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Danh sách trích xuất (Bảng Excel)</h2>
                <div className="text-xs text-slate-400 font-medium">
                  Tổng cộng: {results.length}
                </div>
              </div>

              <div className="flex-1 overflow-x-auto custom-scrollbar border border-slate-100 rounded-xl">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-12 text-center">STT</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Số CCCD</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ngày cấp</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Họ và tên</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ngày sinh</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quê quán</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Thường trú</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-16 text-center">Copy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    <AnimatePresence initial={false}>
                      {results.length > 0 ? (
                        results.map((item, index) => {
                          const lineText = formatResultLine(item);
                          return (
                            <motion.tr 
                              key={index}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="hover:bg-blue-50/30 transition-colors group"
                            >
                              <td className="px-4 py-3 text-xs font-bold text-slate-400 text-center">
                                {index + 1}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-700 font-medium whitespace-nowrap">
                                {item.idNumber}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                                {item.issueDate}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-900 font-bold uppercase whitespace-nowrap">
                                {item.fullName}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                                {item.dateOfBirth}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-600 max-w-[150px] truncate" title={item.hometown}>
                                {item.hometown}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-600 max-w-[200px] truncate" title={item.permanentResidence}>
                                {item.permanentResidence}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button 
                                  onClick={() => copyToClipboard(lineText, index)}
                                  className={`p-1.5 rounded-lg transition-all ${
                                    copySuccess === index 
                                      ? 'bg-green-100 text-green-600' 
                                      : 'bg-white text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 opacity-0 group-hover:opacity-100'
                                  }`}
                                  title="Copy hàng này"
                                >
                                  {copySuccess === index ? (
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  ) : (
                                    <FileText className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </td>
                            </motion.tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-20 text-center">
                            <div className="flex flex-col items-center justify-center text-slate-300 gap-2">
                              <FileText className="w-10 h-10 opacity-20" />
                              <p className="text-sm">Chưa có kết quả nào</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="max-w-4xl mx-auto px-4 py-12 text-center text-slate-400 text-xs">
        <p>© 2026 CCCD Reader AI - Powered by Gemini 3.0 Flash</p>
      </footer>
    </div>
  );
}

function Field({ 
  label, 
  value, 
  icon, 
  loading, 
  error,
  className = "" 
}: { 
  label: string; 
  value?: string; 
  icon: React.ReactNode; 
  loading: boolean;
  error?: string;
  className?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
        {icon}
        {label}
      </label>
      <div className={`
        min-h-[44px] px-4 py-2.5 rounded-xl border flex items-center transition-all relative
        ${loading ? 'animate-pulse bg-slate-100 border-slate-200' : ''}
        ${!loading && value && !error ? 'border-blue-100 bg-blue-50/20' : 'border-slate-100 bg-slate-50/50'}
        ${!loading && error ? 'border-red-200 bg-red-50/30' : ''}
      `}>
        <span className={`text-sm text-slate-700 ${className} ${!value && !loading ? 'text-slate-300 italic' : ''}`}>
          {loading ? '' : (value || 'Chưa có dữ liệu')}
        </span>
        
        {!loading && error && (
          <div className="absolute -bottom-5 left-1 flex items-center gap-1 text-[9px] font-bold text-red-500 animate-in fade-in slide-in-from-top-1">
            <AlertCircle className="w-2.5 h-2.5" />
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

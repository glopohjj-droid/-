import React, { useState, useEffect, useRef } from 'react';
import { 
  Newspaper, 
  Clock, 
  Lock, 
  Unlock, 
  Key, 
  PenTool, 
  Image as ImageIcon, 
  Upload, 
  Trash2, 
  Info, 
  List, 
  Calendar,
  AlertCircle,
  Loader2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { NewsArticle } from './types';

export default function App() {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [adminKey, setAdminKey] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  
  // Form states
  const [title, setTitle] = useState<string>('');
  const [text, setText] = useState<string>('');
  const [imageData, setImageData] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // App feedback states
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  
  // Live clock
  const [currentTime, setCurrentTime] = useState<string>('');

  // 1. Tick Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Fetch news on load
  const loadContent = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/news');
      if (res.ok) {
        const data = await res.json();
        // Sort newest first
        setNews(data.sort((a: NewsArticle, b: NewsArticle) => b.timestamp - a.timestamp));
      } else {
        throw new Error('Не удалось загрузить новости с сервера.');
      }
    } catch (err: any) {
      console.warn('API error, falling back to localStorage caching:', err);
      // Fallback cache
      const local = localStorage.getItem('newsApp_articles');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          setNews(parsed.sort((a: any, b: any) => b.timestamp - a.timestamp));
        } catch {
          setNews([]);
        }
      } else {
        setNews([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContent();
  }, []);

  // Sync to local storage whenever news changes (so fallback is always up to date!)
  useEffect(() => {
    if (news.length > 0) {
      localStorage.setItem('newsApp_articles', JSON.stringify(news));
    } else {
      localStorage.removeItem('newsApp_articles');
    }
  }, [news]);

  // 3. Unlock Admin
  const handleUnlock = () => {
    setErrorMsg('');
    setSuccessMsg('');
    if (passwordInput.trim() === 'admin123') {
      setIsAdmin(true);
      setAdminKey('admin123');
      setPasswordInput('');
      setSuccessMsg('Доступ разрешен. Добро пожаловать, Администратор!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } else {
      setErrorMsg('Неверный ключ доступа.');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  // 4. Lock Admin
  const handleLock = () => {
    setIsAdmin(false);
    setAdminKey('');
    setPasswordInput('');
    setErrorMsg('');
    setSuccessMsg('Вы вышли из режима администратора.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleUnlock();
    }
  };

  // 5. Handle news image selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setErrorMsg('Пожалуйста, выберите изображение (jpg, png, webp и т.д.)');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setImageData(ev.target.result as string);
        }
      };
      reader.onerror = () => {
        setErrorMsg('Не удалось прочитать файл изображения.');
      };
      reader.readAsDataURL(file);
    }
  };

  // 6. Submit news article
  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !adminKey) {
      setErrorMsg('Только администратор может публиковать новости.');
      return;
    }

    if (!title.trim() || !text.trim()) {
      setErrorMsg('Заполните заголовок и текст новости.');
      return;
    }

    setUploading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/news', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify({
          title: title.trim(),
          text: text.trim(),
          imageData: imageData,
        }),
      });

      if (res.ok) {
        const newArt = await res.json();
        // Insert at index 0 of news
        setNews((prev) => [newArt, ...prev]);
        setSuccessMsg('Новость успешно опубликована!');
        
        // Reset inputs
        setTitle('');
        setText('');
        setImageData(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }

        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Ошибка публикации новости на сервере');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Ошибка подключения к серверу при отправке.');
    } finally {
      setUploading(false);
    }
  };

  // 7. Delete single article
  const handleDeleteArticle = async (id: string) => {
    if (!isAdmin || !adminKey) {
      setErrorMsg('Нет прав для удаления.');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/news/${id}`, {
        method: 'DELETE',
        headers: {
          'x-admin-key': adminKey,
        },
      });

      if (res.ok) {
        setNews((prev) => prev.filter((item) => item.id !== id));
        setSuccessMsg('Новость удалена.');
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        throw new Error('Ошибка при удалении на сервере.');
      }
    } catch (err: any) {
      // Offline fallback
      setNews((prev) => prev.filter((item) => item.id !== id));
      setErrorMsg('Сервер недоступен, новость удалена локально.');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  // 8. Delete all articles
  const handleClearAllNews = async () => {
    if (!isAdmin || !adminKey) return;
    
    if (window.confirm('Удалить все новости без возможности восстановления?')) {
      setErrorMsg('');
      setSuccessMsg('');
      try {
        const res = await fetch('/api/news', {
          method: 'DELETE',
          headers: {
            'x-admin-key': adminKey,
          },
        });

        if (res.ok) {
          setNews([]);
          setSuccessMsg('Все новости удалены.');
          setTimeout(() => setSuccessMsg(''), 3000);
        } else {
          throw new Error('Ошибка сервера при очистке новостей.');
        }
      } catch (err: any) {
        setNews([]);
        setErrorMsg('Сервер недоступен, лента очищена локально.');
        setTimeout(() => setErrorMsg(''), 4000);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fa] text-[#1e293b] py-10 px-4 md:px-8 font-sans transition-colors duration-200">
      <div className="max-w-4xl mx-auto flex flex-col gap-8">
        
        {/* Upper Feedback Banner */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl flex items-center justify-between shadow-sm"
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="text-red-500 h-5 w-5 shrink-0" />
                <p className="text-sm font-medium text-red-800">{errorMsg}</p>
              </div>
              <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-600">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}

          {successMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-xl flex items-center justify-between shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                <p className="text-sm font-medium text-emerald-800">{successMsg}</p>
              </div>
              <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-emerald-600">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header Block */}
        <div className="bg-white rounded-[32px] p-6 md:p-8 shadow-xl shadow-slate-100/60 border border-slate-100 transition-all">
          <div className="flex items-center gap-4 text-slate-900 mb-2">
            <motion.div 
              whileHover={{ rotate: -8, scale: 1.1 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="bg-blue-500 p-3 rounded-2xl text-white shadow-md shadow-blue-500/20"
            >
              <Newspaper className="h-8 w-8" />
            </motion.div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Новостной портал</h1>
          </div>
          
          <div className="flex flex-wrap justify-between items-center gap-4 mt-6 border-l-4 border-blue-500 pl-4 py-1">
            <div className="flex items-center gap-2 text-slate-500 font-medium text-sm md:text-base">
              <Clock className="h-4 w-4 text-slate-400 animate-pulse" />
              <span>Свежие новости {currentTime && ` • ${currentTime}`}</span>
            </div>
            
            <motion.span 
              layout
              key={isAdmin ? 'admin-on' : 'admin-off'}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs md:text-sm font-semibold shadow-sm transition-all duration-300 ${
                isAdmin 
                  ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              {isAdmin ? (
                <>
                  <Unlock className="h-3.5 w-3.5 text-blue-500" />
                  <span>Админ-режим: вкл</span>
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5 text-slate-400" />
                  <span>Админ-режим: выкл</span>
                </>
              )}
            </motion.span>
          </div>

          {/* Access Credentials Block */}
          <div className="bg-slate-50 border border-slate-200/60 p-3 md:p-4 rounded-3xl mt-6 flex flex-wrap items-center gap-3">
            <Key className="h-4 w-4 text-slate-400 ml-2" />
            <input 
              type="password" 
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={isAdmin}
              placeholder={isAdmin ? "Доступ активирован" : "Введите ключ доступа (admin123)"}
              className="flex-1 min-w-[200px] bg-white rounded-2xl px-4 py-2.5 font-medium text-slate-800 text-sm md:text-base border border-slate-200/80 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-100/50 disabled:text-slate-400 transition-all placeholder:text-slate-400"
              autoComplete="off"
            />
            {isAdmin ? (
              <button 
                onClick={handleLock}
                className="inline-flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 active:scale-95 text-slate-700 font-semibold text-sm px-6 py-2.5 rounded-full transition-all"
              >
                <Lock className="h-4 w-4" />
                <span>Выйти</span>
              </button>
            ) : (
              <button 
                onClick={handleUnlock}
                className="inline-flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 active:scale-95 text-white font-semibold text-sm px-6 py-2.5 rounded-full shadow-md shadow-blue-500/15 transition-all"
              >
                <Unlock className="h-4 w-4" />
                <span>Войти</span>
              </button>
            )}
          </div>

          {/* Admin Publication Form (Rendered only when isAdmin) */}
          <AnimatePresence>
            {isAdmin && (
              <motion.div 
                initial={{ height: 0, opacity: 0, marginTop: 0 }}
                animate={{ height: "auto", opacity: 1, marginTop: 24 }}
                exit={{ height: 0, opacity: 0, marginTop: 0 }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <form onSubmit={handlePublish} className="bg-slate-50 border border-slate-200/80 rounded-3xl p-5 md:p-6 flex flex-col gap-4">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-2">
                    <PenTool className="h-5 w-5 text-blue-500" />
                    <span>Создать новость</span>
                  </h2>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-slate-600">Заголовок</label>
                    <input 
                      type="text" 
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      placeholder="Например: Открытие нового ландшафтного парка"
                      className="bg-white rounded-2xl px-4 py-3 border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 text-slate-800 transition-all font-medium"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-slate-600">Текст новости</label>
                    <textarea 
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      required
                      placeholder="Подробности события в деталях..."
                      rows={4}
                      className="bg-white rounded-2xl px-4 py-3 border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 text-slate-800 transition-all font-medium resize-vertical min-h-[100px]"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-slate-600 flex items-center gap-1.5">
                      <ImageIcon className="h-4 w-4 text-slate-400" />
                      <span>Фото (JPEG, PNG, WEBP)</span>
                    </label>
                    <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        onChange={handleImageChange}
                        accept="image/*"
                        className="flex-1 bg-white text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-slate-200 rounded-2xl file:outline-none file:cursor-pointer p-1.5 text-sm cursor-pointer"
                      />
                      {imageData && (
                        <div className="flex items-center gap-2 shrink-0 bg-blue-50 text-blue-700 px-4 py-2 rounded-2xl text-xs font-semibold self-start border border-blue-100">
                          <ImageIcon className="h-4 w-4" />
                          <span>Файл загружен</span>
                          <button 
                            type="button" 
                            onClick={() => {
                              setImageData(null);
                              if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            className="bg-blue-200 hover:bg-blue-300 text-blue-800 rounded-full p-0.5 ml-1 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 mt-1">Файл сохраняется непосредственно на сервер и автоматически доступен всем пользователям.</span>
                  </div>

                  <div className="flex flex-wrap gap-3 mt-4 border-t border-slate-200/60 pt-4">
                    <button 
                      type="submit" 
                      disabled={uploading}
                      className="inline-flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 active:scale-95 disabled:bg-blue-300 text-white font-bold text-sm px-6 py-3.5 rounded-full shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Публикация...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          <span>Опубликовать</span>
                        </>
                      )}
                    </button>
                    
                    <button 
                      type="button" 
                      onClick={handleClearAllNews}
                      className="inline-flex items-center justify-center gap-2 bg-red-100 hover:bg-red-200 active:scale-95 text-red-700 font-bold text-sm px-6 py-3.5 rounded-full transition-all cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Удалить все</span>
                    </button>
                  </div>
                  
                  <div className="flex items-start gap-2 text-xs text-slate-500 bg-white/60 p-3.5 rounded-2xl border border-slate-200/40">
                    <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <span>Все публикуемые новости моментально сохраняются в базу данных на сервере. При перезагрузке страницы, очистке браузера или посещении сайта другими пользователями — данные сайта полностью сохраняются.</span>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* News Feed Category Title */}
        <div className="bg-white rounded-[32px] p-6 shadow-xl shadow-slate-100/60 border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <List className="h-5 w-5 text-blue-500" />
              <span>Лента новостей</span>
            </h2>
            <span className="bg-blue-50 text-blue-700 border border-blue-100 px-4 py-1.5 rounded-full font-bold text-sm shadow-sm">
              {news.length}
            </span>
          </div>

          {/* Loader or Feed Content */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="font-semibold text-sm">Синхронизация с сервером...</p>
            </div>
          ) : (
            <div className="space-y-6">
              <AnimatePresence initial={false}>
                {news.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-16 text-center text-slate-400 bg-slate-50/50 rounded-2xl p-6 border-2 border-dashed border-slate-200"
                  >
                    <Newspaper className="h-16 w-16 text-slate-200 mb-4 stroke-1 animate-bounce" />
                    <h3 className="font-bold text-slate-700 text-lg mb-1">Пока нет новостей</h3>
                    <p className="text-sm max-w-xs leading-relaxed text-slate-500">Войдите в панель администратора для публикации первых событий.</p>
                  </motion.div>
                ) : (
                  news.map((item) => (
                    <motion.div 
                      key={item.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -15 }}
                      transition={{ type: "spring", stiffness: 350, damping: 25 }}
                      className="bg-white rounded-3xl p-5 md:p-6 shadow-md shadow-slate-100 border border-slate-100/80 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/50 hover:-translate-y-1 transition-all duration-300 flex flex-col gap-4 group"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors duration-200 leading-snug">
                          {item.title}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 shrink-0 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-full select-none">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span>{item.date}</span>
                        </div>
                      </div>

                      <p className="text-[#334155] leading-relaxed text-sm md:text-base whitespace-pre-wrap word-break: break-word font-normal">
                        {item.text}
                      </p>

                      {item.imageData && (
                        <div className="overflow-hidden rounded-2xl max-h-[460px] bg-slate-50 border border-slate-100 flex justify-center items-center">
                          <img 
                            src={item.imageData} 
                            alt={item.title} 
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            className="w-full h-auto object-cover max-h-[460px] hover:scale-102 transition-transform duration-500 ease-out"
                          />
                        </div>
                      )}

                      {/* Admin Controls */}
                      {isAdmin && (
                        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-2">
                          <button 
                            onClick={() => handleDeleteArticle(item.id)}
                            className="inline-flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 active:scale-95 text-red-600 font-bold text-xs px-4 py-2 rounded-full cursor-pointer transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Удалить</span>
                          </button>
                        </div>
                      )}
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}

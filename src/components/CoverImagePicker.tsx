import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Link, X, Loader2, Sparkles, Check } from 'lucide-react';
import { getActiveTabImages } from '../services/extractor';

interface CoverImagePickerProps {
  coverUrl?: string;
  currentCover?: string;
  isOpen?: boolean;
  onClose?: () => void;
  onSelectCover: (url?: string) => void;
}

export const CoverImagePicker: React.FC<CoverImagePickerProps> = ({
  coverUrl,
  currentCover,
  isOpen: externalIsOpen,
  onClose,
  onSelectCover,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const effectiveCover = currentCover !== undefined ? currentCover : coverUrl;

  const setIsOpen = (val: boolean) => {
    if (!val && onClose) {
      onClose();
    }
    setInternalIsOpen(val);
  };

  const [pageImages, setPageImages] = useState<string[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'page' | 'url'>('page');

  useEffect(() => {
    if (isOpen && activeTab === 'page' && pageImages.length === 0) {
      setLoadingImages(true);
      getActiveTabImages()
        .then((images) => {
          setPageImages(images);
        })
        .finally(() => {
          setLoadingImages(false);
        });
    }
  }, [isOpen, activeTab, pageImages.length]);

  const handleApplyCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (customUrl.trim()) {
      onSelectCover(customUrl.trim());
      setCustomUrl('');
      setIsOpen(false);
    }
  };

  return (
    <div>
      {/* Visualização da Capa Atual (se não estiver controlado externamente) */}
      {externalIsOpen === undefined && (
        effectiveCover ? (
          <div className="relative group rounded-lg overflow-hidden h-28 border border-gray-200 bg-gray-100 shadow-xs">
            <img
              src={effectiveCover}
              alt="Capa"
              className="w-full h-full object-cover"
              onError={() => onSelectCover(undefined)}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="py-1 px-2 bg-white/90 hover:bg-white text-gray-800 rounded text-[11px] font-medium shadow-xs cursor-pointer"
              >
                Trocar Capa
              </button>
              <button
                type="button"
                onClick={() => onSelectCover(undefined)}
                className="py-1 px-2 bg-red-600/90 hover:bg-red-600 text-white rounded text-[11px] font-medium shadow-xs cursor-pointer"
              >
                Remover
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="w-full h-20 border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-lg flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-blue-600 transition-colors bg-white/50 cursor-pointer"
          >
            <ImageIcon className="w-5 h-5 text-gray-400" />
            <span className="text-xs font-medium">Adicionar Imagem de Capa</span>
          </button>
        )
      )}

      {/* Modal / Dialog de Seleção de Capa */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
              <div className="flex items-center gap-1.5 font-semibold text-gray-900 text-xs">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Escolher Imagem de Capa</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Abas: Da Página vs Inserir Link */}
            <div className="flex border-b border-gray-100 bg-gray-50 text-[11px]">
              <button
                type="button"
                onClick={() => setActiveTab('page')}
                className={`flex-1 py-2 font-medium text-center border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'page'
                    ? 'border-blue-600 text-blue-600 bg-white font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                Imagens da Página ({pageImages.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('url')}
                className={`flex-1 py-2 font-medium text-center border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'url'
                    ? 'border-blue-600 text-blue-600 bg-white font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                Inserir Link URL
              </button>
            </div>

            {/* Conteúdo */}
            <div className="p-3 overflow-y-auto max-h-[300px] flex-1">
              {activeTab === 'page' ? (
                loadingImages ? (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-400 space-y-2">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    <span>Carregando imagens da página...</span>
                  </div>
                ) : pageImages.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 space-y-2">
                    <p>Nenhuma imagem relevante encontrada no site ativo.</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('url')}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      Inserir link personalizado
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {pageImages.map((src, i) => (
                      <div
                        key={i}
                        onClick={() => {
                          onSelectCover(src);
                          setIsOpen(false);
                        }}
                        className={`group relative h-24 rounded-lg overflow-hidden border cursor-pointer transition-all ${
                          effectiveCover === src
                            ? 'border-blue-600 ring-2 ring-blue-500/30'
                            : 'border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        <img src={src} alt="" className="w-full h-full object-cover" />
                        {effectiveCover === src && (
                          <div className="absolute top-1 right-1 bg-blue-600 text-white rounded-full p-0.5">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <form onSubmit={handleApplyCustomUrl} className="space-y-3 py-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-gray-700">Link direto da imagem (URL):</label>
                    <div className="relative">
                      <Link className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                      <input
                        type="url"
                        required
                        value={customUrl}
                        onChange={(e) => setCustomUrl(e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                        className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Usar Imagem
                  </button>
                </form>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-100 flex justify-between items-center bg-gray-50 text-xs">
              {effectiveCover ? (
                <button
                  type="button"
                  onClick={() => {
                    onSelectCover(undefined);
                    setIsOpen(false);
                  }}
                  className="text-red-500 hover:underline font-medium"
                >
                  Remover Capa
                </button>
              ) : (
                <div />
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="py-1 px-3 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-medium cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import {
  Settings,
  Plus,
  FolderPlus,
  ChevronRight,
  Sparkles,
  History,
  X,
  ExternalLink,
} from 'lucide-react';
import type { FormConfig } from '../types';

interface SelectFormViewProps {
  forms: FormConfig[];
  onSelectForm: (formId: string) => void;
  onOpenCreateForm: () => void;
  onOpenSettings: () => void;
  justCreatedFormName?: string | null;
  onDismissBanner?: () => void;
}

export const SelectFormView: React.FC<SelectFormViewProps> = ({
  forms,
  onSelectForm,
  onOpenCreateForm,
  onOpenSettings,
  justCreatedFormName,
  onDismissBanner,
}) => {
  const [bannerClosed, setBannerClosed] = useState(false);

  // Fecha o iframe embutido na página via postMessage
  const handleClose = () => {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ action: 'NOTION_SAVE_CLOSE' }, '*');
    }
  };

  const showBanner = !!justCreatedFormName && !bannerClosed;

  return (
    <div className="flex flex-col min-h-[460px] w-full bg-[#f8f9fa] text-xs text-gray-800">
      {/* Top Header Estilo Save.to */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-white border-b border-gray-100">
        <span className="font-bold text-sm text-gray-900 tracking-tight">Notion Save</span>
        <div className="flex items-center gap-2 text-gray-500">
          <button
            type="button"
            title="Dicas & Atalhos"
            className="p-1 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Histórico de Páginas Salvas"
            className="p-1 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
          >
            <History className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleClose}
            title="Fechar"
            className="p-1 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Banner de Feedback Azul após criar um Form (Estilo Save.to) */}
      {showBanner && (
        <div className="bg-[#e8f2fe] border-b border-blue-100 px-3.5 py-2 flex items-center justify-between text-blue-700 text-xs font-medium animate-fadeIn">
          <span>Your form is created! Try it now.</span>
          <button
            type="button"
            onClick={() => {
              setBannerClosed(true);
              if (onDismissBanner) onDismissBanner();
            }}
            className="flex items-center gap-1 text-[11px] text-blue-800 hover:underline cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Close</span>
          </button>
        </div>
      )}

      <div className="p-3.5 space-y-3.5 flex-1">
        {/* Título da Seção: Select Form + Ícone de Configurações */}
        <div className="flex items-center justify-between px-0.5">
          <h2 className="font-bold text-xs text-gray-700 tracking-wide">Select Form</h2>
          <button
            type="button"
            onClick={onOpenSettings}
            title="Configurações e Conexão Notion"
            className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-full transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Lista de Formulários em Cards Arredondados */}
        <div className="space-y-2">
          {forms.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center space-y-2">
              <p className="text-gray-500 font-medium">Nenhum formulário criado ainda.</p>
              <p className="text-[11px] text-gray-400">
                Clique em "+ Add New Form" abaixo para conectar uma database ou página do Notion.
              </p>
            </div>
          ) : (
            forms.map((form) => (
              <div
                key={form.id}
                className="w-full flex items-center justify-between p-3 bg-white hover:bg-gray-50/80 border border-gray-200/90 rounded-xl shadow-2xs transition-all text-left group"
              >
                <button
                  type="button"
                  onClick={() => onSelectForm(form.id)}
                  className="flex items-center gap-3 truncate flex-1 min-w-0 cursor-pointer text-left"
                >
                  <span className="text-xl shrink-0 p-1 bg-gray-50 rounded-lg group-hover:bg-white transition-colors">
                    {form.icon || '🔖'}
                  </span>
                  <div className="truncate flex-1 min-w-0">
                    <div className="font-bold text-xs text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                      {form.name}
                    </div>
                    <div className="text-[10px] text-gray-400 truncate" title={form.showFullPath && form.destinationPath ? form.destinationPath : form.databaseTitle}>
                      {form.showFullPath && form.destinationPath ? form.destinationPath : form.databaseTitle}
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <a
                    href={form.destinationUrl || `https://www.notion.so/${form.databaseId.replace(/-/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title="Abrir no Notion em nova aba"
                    className="p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => onSelectForm(form.id)}
                    className="p-1 text-gray-300 group-hover:text-gray-600 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Botão + Add New Form */}
        <div className="pt-1">
          <button
            type="button"
            onClick={onOpenCreateForm}
            className="w-full flex items-center justify-between p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200/50 rounded-lg transition-colors cursor-pointer text-xs font-semibold"
          >
            <div className="flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-gray-500" />
              <span>Add New Form</span>
            </div>
            <FolderPlus className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
};

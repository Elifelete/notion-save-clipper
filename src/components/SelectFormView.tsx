import React, { useState } from 'react';
import {
  Settings,
  Plus,
  FolderPlus,
  ChevronRight,
  Sparkles,
  History,
  X,
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

  const showBanner = Boolean(justCreatedFormName && !bannerClosed);

  return (
    <div className="flex flex-col min-h-[440px] bg-[#f8f9fa] text-xs text-gray-800">
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
            onClick={() => window.close()}
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
              <button
                key={form.id}
                type="button"
                onClick={() => onSelectForm(form.id)}
                className="w-full flex items-center justify-between p-3 bg-white hover:bg-gray-50/80 active:bg-gray-100 border border-gray-200/90 rounded-xl shadow-2xs transition-all text-left cursor-pointer group"
              >
                <div className="flex items-center gap-3 truncate">
                  <span className="text-xl shrink-0 p-1 bg-gray-50 rounded-lg group-hover:bg-white transition-colors">
                    {form.icon || '🔖'}
                  </span>
                  <div className="truncate">
                    <div className="font-bold text-xs text-gray-900 truncate">
                      {form.name}
                    </div>
                    <div className="text-[10px] text-gray-400 truncate">
                      {form.databaseTitle}
                    </div>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-600 transition-colors shrink-0 ml-2" />
              </button>
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

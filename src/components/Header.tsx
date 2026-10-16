import React from 'react';
import { Settings, PlusCircle, ExternalLink, Bookmark } from 'lucide-react';
import type { FormConfig } from '../types';

interface HeaderProps {
  forms: FormConfig[];
  selectedFormId?: string;
  onSelectForm: (id: string) => void;
  onOpenSettings: () => void;
  onOpenCreateForm: () => void;
  currentView: 'save' | 'settings' | 'create_form';
  onBackToSave: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  forms,
  selectedFormId,
  onSelectForm,
  onOpenSettings,
  onOpenCreateForm,
  currentView,
  onBackToSave,
}) => {
  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-3 py-2.5 shadow-xs">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-black text-white font-bold text-xs shadow-xs">
          N
        </div>
        {currentView === 'save' ? (
          forms.length > 0 ? (
            <div className="relative">
              <select
                value={selectedFormId || ''}
                onChange={(e) => onSelectForm(e.target.value)}
                className="text-xs font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-md py-1 px-2 pr-6 appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                {forms.map((form) => (
                  <option key={form.id} value={form.id}>
                    {form.icon} {form.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-gray-500 text-xs">
                ▼
              </div>
            </div>
          ) : (
            <span className="text-xs font-semibold text-gray-700">Notion Save</span>
          )
        ) : (
          <button
            onClick={onBackToSave}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors cursor-pointer"
          >
            ← Voltar
          </button>
        )}
      </div>

      <div className="flex items-center gap-1">
        {currentView === 'save' && (
          <button
            onClick={onOpenCreateForm}
            title="Criar novo Formulário"
            className="flex items-center gap-1 text-[11px] font-medium text-gray-600 hover:text-black bg-gray-50 hover:bg-gray-100 border border-gray-200 px-2 py-1 rounded-md transition-colors cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5 text-blue-600" />
            <span>Form</span>
          </button>
        )}

        <button
          onClick={onOpenSettings}
          title="Configurações & Chave API"
          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
            currentView === 'settings'
              ? 'bg-gray-200 text-black'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
          }`}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

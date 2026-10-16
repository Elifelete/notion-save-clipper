import React, { useState, useEffect } from 'react';
import { SettingsView } from '@/src/components/SettingsView';
import { CreateFormView } from '@/src/components/CreateFormView';
import { SavePageView } from '@/src/components/SavePageView';
import { SelectFormView } from '@/src/components/SelectFormView';
import { getApiKey, getForms, getDefaultFormId, setDefaultFormId } from '@/src/services/storage';
import { getActiveTabMetadata } from '@/src/services/extractor';
import type { FormConfig, ExtractedMetadata } from '@/src/types';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [apiKey, setApiKey] = useState<string>('');
  const [forms, setForms] = useState<FormConfig[]>([]);
  const [selectedFormId, setSelectedFormIdState] = useState<string>('');
  const [metadata, setMetadata] = useState<ExtractedMetadata | null>(null);
  const [loading, setLoading] = useState(true);

  // Telas: 'select_form' (Home estilo Save.to), 'save' (Save to Notion), 'create_form', 'settings'
  const [currentView, setCurrentView] = useState<'select_form' | 'save' | 'settings' | 'create_form'>('save');
  const [justCreatedFormName, setJustCreatedFormName] = useState<string | null>(null);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const storedKey = await getApiKey();
      const storedForms = await getForms();
      const defaultId = await getDefaultFormId();
      const meta = await getActiveTabMetadata();

      setApiKey(storedKey);
      setForms(storedForms);
      setMetadata(meta);

      if (!storedKey) {
        setCurrentView('settings');
      } else if (storedForms.length === 0) {
        setCurrentView('create_form');
      } else {
        const activeId =
          storedForms.find((f) => f.id === defaultId)?.id || (storedForms[0] ? storedForms[0].id : '');
        setSelectedFormIdState(activeId);
        setCurrentView('save');
      }
    } catch (e) {
      console.error('Erro ao inicializar extensão:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleSelectForm = async (id: string) => {
    setSelectedFormIdState(id);
    await setDefaultFormId(id);
    setCurrentView('save');
  };

  const handleApiKeySaved = async () => {
    const updatedKey = await getApiKey();
    setApiKey(updatedKey);
    const updatedForms = await getForms();
    setForms(updatedForms);
    if (updatedForms.length === 0) {
      setCurrentView('create_form');
    } else {
      setCurrentView('select_form');
    }
  };

  const handleFormCreated = async (newForm: FormConfig) => {
    const updatedForms = await getForms();
    setForms(updatedForms);
    setSelectedFormIdState(newForm.id);
    await setDefaultFormId(newForm.id);
    setJustCreatedFormName(newForm.name);
    setCurrentView('select_form');
  };

  if (loading) {
    return (
      <div className="flex h-[480px] w-full items-center justify-center text-gray-500 bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  const selectedForm = forms.find((f) => f.id === selectedFormId) || forms[0];

  return (
    <div className="flex flex-col min-h-[480px] w-full bg-[#f8f9fa] font-sans text-gray-900 select-none overflow-x-hidden">
      <main className="flex-1 w-full flex flex-col">
        {/* TELA 1: Select Form (Home) */}
        {currentView === 'select_form' && (
          <SelectFormView
            forms={forms}
            onSelectForm={handleSelectForm}
            onOpenCreateForm={() => setCurrentView('create_form')}
            onOpenSettings={() => setCurrentView('settings')}
            justCreatedFormName={justCreatedFormName}
            onDismissBanner={() => setJustCreatedFormName(null)}
          />
        )}

        {/* TELA 2: Save Page (Save to Notion) */}
        {currentView === 'save' && (
          selectedForm && metadata ? (
            <SavePageView
              apiKey={apiKey}
              form={selectedForm}
              metadata={metadata}
              onBackToSelectForm={() => setCurrentView('select_form')}
              onOpenSettings={() => setCurrentView('settings')}
            />
          ) : (
            <div className="p-6 text-center space-y-3 bg-white min-h-[480px] flex flex-col items-center justify-center">
              <p className="text-gray-500 text-xs">Nenhum formulário ativo selecionado.</p>
              <button
                onClick={() => setCurrentView('create_form')}
                className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg"
              >
                Criar Formulário
              </button>
            </div>
          )
        )}

        {/* TELA 3: Create Form */}
        {currentView === 'create_form' && (
          <CreateFormView
            apiKey={apiKey}
            onFormCreated={handleFormCreated}
            onCancel={() => {
              if (forms.length > 0) setCurrentView('select_form');
              else setCurrentView('settings');
            }}
          />
        )}

        {/* TELA 4: Settings & Conexão Notion */}
        {currentView === 'settings' && (
          <SettingsView
            onApiKeySaved={handleApiKeySaved}
            onNavigateToCreateForm={() => setCurrentView('create_form')}
          />
        )}
      </main>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Header } from '@/src/components/Header';
import { SettingsView } from '@/src/components/SettingsView';
import { CreateFormView } from '@/src/components/CreateFormView';
import { SavePageView } from '@/src/components/SavePageView';
import { getApiKey, getForms, getDefaultFormId, setDefaultFormId } from '@/src/services/storage';
import { getActiveTabMetadata } from '@/src/services/extractor';
import type { FormConfig, ExtractedMetadata } from '@/src/types';
import { Loader2, Plus, Sparkles } from 'lucide-react';

export default function App() {
  const [apiKey, setApiKey] = useState<string>('');
  const [forms, setForms] = useState<FormConfig[]>([]);
  const [selectedFormId, setSelectedFormIdState] = useState<string>('');
  const [metadata, setMetadata] = useState<ExtractedMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'save' | 'settings' | 'create_form'>('save');

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
  };

  const handleApiKeySaved = async () => {
    const updatedKey = await getApiKey();
    setApiKey(updatedKey);
    const updatedForms = await getForms();
    setForms(updatedForms);
    if (updatedForms.length === 0) {
      setCurrentView('create_form');
    } else {
      setCurrentView('save');
    }
  };

  const handleFormCreated = async (newForm: FormConfig) => {
    const updatedForms = await getForms();
    setForms(updatedForms);
    setSelectedFormIdState(newForm.id);
    await setDefaultFormId(newForm.id);
    setCurrentView('save');
  };

  if (loading) {
    return (
      <div className="flex h-96 w-full items-center justify-center text-gray-500 bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  const selectedForm = forms.find((f) => f.id === selectedFormId) || forms[0];

  return (
    <div className="flex flex-col min-h-[480px] bg-white font-sans text-gray-900 select-none">
      <Header
        forms={forms}
        selectedFormId={selectedFormId}
        onSelectForm={handleSelectForm}
        onOpenSettings={() => setCurrentView('settings')}
        onOpenCreateForm={() => setCurrentView('create_form')}
        currentView={currentView}
        onBackToSave={() => setCurrentView('save')}
      />

      <main className="flex-1 overflow-y-auto">
        {currentView === 'settings' && (
          <SettingsView
            onApiKeySaved={handleApiKeySaved}
            onNavigateToCreateForm={() => setCurrentView('create_form')}
          />
        )}

        {currentView === 'create_form' && (
          <CreateFormView
            apiKey={apiKey}
            onFormCreated={handleFormCreated}
            onCancel={() => {
              if (forms.length > 0) setCurrentView('save');
              else setCurrentView('settings');
            }}
          />
        )}

        {currentView === 'save' && (
          <>
            {forms.length === 0 || !selectedForm ? (
              <div className="p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-sm text-gray-900">Nenhum Formulário Configurado</h3>
                <p className="text-xs text-gray-500">
                  Crie seu primeiro formulário personalizado para começar a salvar páginas no Notion.
                </p>
                <button
                  onClick={() => setCurrentView('create_form')}
                  className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-md shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Criar Primeiro Form
                </button>
              </div>
            ) : (
              metadata && (
                <SavePageView
                  apiKey={apiKey}
                  form={selectedForm}
                  metadata={metadata}
                />
              )
            )}
          </>
        )}
      </main>
    </div>
  );
}

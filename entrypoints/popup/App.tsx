import React, { useState, useEffect } from 'react';
import { SettingsView } from '@/src/components/SettingsView';
import { CreateFormView } from '@/src/components/CreateFormView';
import { SavePageView } from '@/src/components/SavePageView';
import { SelectFormView } from '@/src/components/SelectFormView';
import { getApiKey, getForms, getDefaultFormId, setDefaultFormId, deleteForm } from '@/src/services/storage';
import { getActiveTabMetadata } from '@/src/services/extractor';
import type { FormConfig, ExtractedMetadata, SocialPostData } from '@/src/types';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [apiKey, setApiKey] = useState<string>('');
  const [forms, setForms] = useState<FormConfig[]>([]);
  const [selectedFormId, setSelectedFormIdState] = useState<string>('');
  const [editingForm, setEditingForm] = useState<FormConfig | null>(null);
  const [metadata, setMetadata] = useState<ExtractedMetadata | null>(null);
  const [loading, setLoading] = useState(true);

  // Views: 'select_form' (Home style Save.to), 'save' (Save to Notion), 'create_form', 'settings'
  const [currentView, setCurrentView] = useState<'select_form' | 'save' | 'settings' | 'create_form'>('save');
  const [previousView, setPreviousView] = useState<'select_form' | 'save' | 'create_form' | 'settings'>('save');
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
        setEditingForm(null);
        setCurrentView('create_form');
      } else {
        const activeId =
          storedForms.find((f) => f.id === defaultId)?.id || (storedForms[0] ? storedForms[0].id : '');
        setSelectedFormIdState(activeId);
        setCurrentView('save');
      }
    } catch (e) {
      console.error('Error initializing extension:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Notifies the host on load and listens to postMessage with social post data
  useEffect(() => {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ action: 'NOTION_SAVE_POPUP_READY' }, '*');
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.action === 'NOTION_SAVE_SET_SOCIAL_POST' && event.data.socialPost) {
        const post = event.data.socialPost as SocialPostData;
        setMetadata((prev) => ({
          title:
            post.platform === 'twitter'
              ? `Post by @${post.username} on X`
              : `Post by @${post.username} on Instagram`,
          url: post.postUrl,
          description: post.caption,
          author: `@${post.username}`,
          coverImage: prev?.coverImage,
          favicon: prev?.favicon,
          socialPost: post,
        }));
        setCurrentView('save');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Dynamically notifies host page about required iframe height to prevent whitespace / unwanted scrollbars
  useEffect(() => {
    const notifyHeight = () => {
      const contentEl = document.getElementById('root');
      if (!contentEl) return;
      const height = contentEl.scrollHeight;
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ action: 'NOTION_SAVE_RESIZE', height }, '*');
      }
    };

    const timer = setTimeout(notifyHeight, 50);

    const resizeObserver = new ResizeObserver(() => {
      notifyHeight();
    });

    const rootEl = document.getElementById('root') || document.body;
    resizeObserver.observe(rootEl);

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [currentView, loading, forms, selectedFormId]);

  const navigateToSettings = () => {
    if (currentView !== 'settings') {
      setPreviousView(currentView as any);
    }
    setCurrentView('settings');
  };

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
      setEditingForm(null);
      setCurrentView('create_form');
    } else {
      setCurrentView(previousView);
    }
  };

  const handleOpenCreateForm = () => {
    setEditingForm(null);
    if (currentView !== 'create_form') {
      setPreviousView(currentView as any);
    }
    setCurrentView('create_form');
  };

  const handleEditForm = (formToEdit: FormConfig) => {
    setEditingForm(formToEdit);
    if (currentView !== 'create_form') {
      setPreviousView(currentView as any);
    }
    setCurrentView('create_form');
  };

  const handleDeleteFormFromCreate = async (formId: string) => {
    await deleteForm(formId);
    const updatedForms = await getForms();
    setForms(updatedForms);
    setEditingForm(null);
    if (updatedForms.length > 0 && updatedForms[0]) {
      setSelectedFormIdState(updatedForms[0].id);
      setCurrentView('select_form');
    } else {
      setCurrentView('create_form');
    }
  };

  const handleFormSaved = async (savedForm: FormConfig) => {
    const updatedForms = await getForms();
    setForms(updatedForms);
    setSelectedFormIdState(savedForm.id);
    await setDefaultFormId(savedForm.id);
    const wasEditing = !!editingForm;
    setEditingForm(null);

    if (wasEditing) {
      if (previousView === 'settings') {
        setCurrentView('settings');
      } else {
        setCurrentView('save');
      }
    } else {
      setJustCreatedFormName(savedForm.name);
      setCurrentView('select_form');
    }
  };

  const handleCancelCreateOrEdit = () => {
    setEditingForm(null);
    if (previousView === 'settings') {
      setCurrentView('settings');
    } else if (forms.length > 0) {
      setCurrentView(previousView || 'save');
    } else {
      setCurrentView('settings');
    }
  };

  if (loading) {
    return (
      <div className="flex h-[320px] w-full items-center justify-center text-gray-500 bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  const selectedForm = forms.find((f) => f.id === selectedFormId) || forms[0];

  return (
    <div className="flex flex-col w-full bg-[#f8f9fa] font-sans text-gray-900 select-none overflow-x-hidden">
      <main className="w-full flex flex-col">
        {/* VIEW 1: Select Form (Home) */}
        {currentView === 'select_form' && (
          <SelectFormView
            forms={forms}
            onSelectForm={handleSelectForm}
            onOpenCreateForm={handleOpenCreateForm}
            onOpenSettings={navigateToSettings}
            justCreatedFormName={justCreatedFormName}
            onDismissBanner={() => setJustCreatedFormName(null)}
          />
        )}

        {/* VIEW 2: Save Page (Save to Notion) */}
        {currentView === 'save' && (
          selectedForm && metadata ? (
            <SavePageView
              apiKey={apiKey}
              form={selectedForm}
              metadata={metadata}
              onBackToSelectForm={() => setCurrentView('select_form')}
              onOpenSettings={navigateToSettings}
              onEditForm={handleEditForm}
            />
          ) : (
            <div className="p-6 text-center space-y-3 bg-white flex flex-col items-center justify-center min-h-[300px]">
              <p className="text-gray-500 text-xs">No active form selected.</p>
              <button
                onClick={handleOpenCreateForm}
                className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg cursor-pointer"
              >
                Create Form
              </button>
            </div>
          )
        )}

        {/* VIEW 3: Create or Edit Form */}
        {currentView === 'create_form' && (
          <CreateFormView
            apiKey={apiKey}
            initialForm={editingForm || undefined}
            onFormCreated={handleFormSaved}
            onCancel={handleCancelCreateOrEdit}
            onDeleteForm={handleDeleteFormFromCreate}
          />
        )}

        {/* VIEW 4: Settings & Notion Connection */}
        {currentView === 'settings' && (
          <SettingsView
            onApiKeySaved={handleApiKeySaved}
            onNavigateToCreateForm={handleOpenCreateForm}
            onEditForm={handleEditForm}
            onBack={
              forms.length > 0
                ? () => setCurrentView(previousView)
                : undefined
            }
          />
        )}
      </main>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import {
  Key,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Trash2,
  ShieldCheck,
  Database,
  ChevronLeft,
  X,
  Plus,
  Pencil,
} from 'lucide-react';
import { getApiKey, setApiKey, getForms, deleteForm } from '../services/storage';
import { validateNotionApiKey } from '../services/notion';
import { handleHeaderMouseDown } from '../utils/dragHelper';
import type { FormConfig } from '../types';

interface SettingsViewProps {
  onApiKeySaved: () => void;
  onNavigateToCreateForm: () => void;
  onEditForm?: (form: FormConfig) => void;
  onBack?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onApiKeySaved,
  onNavigateToCreateForm,
  onEditForm,
  onBack,
}) => {
  const [keyInput, setKeyInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savedForms, setSavedForms] = useState<FormConfig[]>([]);

  useEffect(() => {
    async function loadData() {
      const existingKey = await getApiKey();
      if (existingKey) {
        setKeyInput(existingKey);
      }
      const forms = await getForms();
      setSavedForms(forms);
    }
    loadData();
  }, []);

  const handleClose = () => {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ action: 'NOTION_SAVE_CLOSE' }, '*');
    }
    window.close();
  };

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter your Notion integration token.' });
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      const result = await validateNotionApiKey(keyInput.trim());
      if (result.valid) {
        await setApiKey(keyInput.trim());
        setStatusMessage({
          type: 'success',
          text: `Successfully connected! Integration: "${result.botName}".`,
        });
        onApiKeySaved();
      } else {
        setStatusMessage({
          type: 'error',
          text: result.error || 'Invalid token or insufficient permissions.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Error connecting to Notion API.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteForm = async (id: string) => {
    if (confirm('Are you sure you want to delete this form?')) {
      await deleteForm(id);
      const updated = await getForms();
      setSavedForms(updated);
    }
  };

  return (
    <div className="flex flex-col min-h-[480px] w-full bg-[#f8f9fa] text-xs text-gray-800">
      {/* Top Header with Back and Close */}
      <div onPointerDown={handleHeaderMouseDown} onMouseDown={handleHeaderMouseDown} title="Drag to move" className="flex items-center justify-between px-3 py-2.5 bg-white border-b border-gray-100 cursor-grab active:cursor-grabbing select-none">
        <div className="flex items-center gap-1.5">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              title="Back"
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-700 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <span className="font-bold text-sm text-gray-900 tracking-tight">Settings</span>
        </div>

        <button
          type="button"
          onClick={handleClose}
          title="Close"
          className="p-1 hover:text-gray-800 hover:bg-gray-100 rounded-full text-gray-400 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4 flex-1">
        {/* Notion Connection Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-3.5 space-y-3">
          <div>
            <h2 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-blue-600" />
              Notion Connection
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Securely connect your Notion account using your internal integration secret.
            </p>
          </div>

          <form onSubmit={handleSaveKey} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Notion Integration Token (API Secret)
              </label>
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full text-xs px-2.5 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono bg-gray-50/50 focus:bg-white"
              />
            </div>

            {statusMessage && (
              <div
                className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                  statusMessage.type === 'success'
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {loading ? 'Validating connection...' : 'Save & Validate Connection'}
            </button>
          </form>
        </div>

        {/* Step-by-Step Instructions */}
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 text-[11px] text-gray-600 space-y-2 shadow-2xs">
          <div className="font-bold text-gray-800 flex items-center gap-1.5 text-xs">
            <ShieldCheck className="w-4 h-4 text-green-600" />
            How to get your token (100% Free):
          </div>
          <ol className="list-decimal list-inside space-y-1.5 text-gray-600 pl-0.5 leading-relaxed">
            <li>
              Go to{' '}
              <a
                href="https://www.notion.so/my-integrations"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline font-semibold inline-flex items-center gap-0.5"
              >
                notion.so/my-integrations <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </li>
            <li>
              Click <b>"New connection"</b> and enter a name (e.g. <i>Save to Notion</i>).
            </li>
            <li>
              Under <b>"Authentication method"</b>, choose <b>"API token"</b> and click <b>"Create connection"</b>.
            </li>
            <li>
              Copy the code under <b>"Internal Integration Secret"</b> (starts with <code className="bg-gray-100 px-1 py-0.5 rounded text-[10px] text-gray-800 font-mono">secret_...</code>) and paste it into the field above.
            </li>
            <li>
              <b>Important:</b> In Notion, open your database or page &gt; click the three dots <b>(...)</b> at the top &gt; <b>Connections</b> &gt; add your integration.
            </li>
          </ol>
        </div>

        {/* Saved Forms */}
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 space-y-2.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-gray-500" />
              Configured Forms ({savedForms.length})
            </h3>
            <button
              onClick={onNavigateToCreateForm}
              className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline font-semibold cursor-pointer inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>Add Form</span>
            </button>
          </div>

          {savedForms.length === 0 ? (
            <p className="text-[11px] text-gray-400">No forms registered yet.</p>
          ) : (
            <div className="space-y-1.5">
              {savedForms.map((form) => (
                <div
                  key={form.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200/80 text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-base">{form.icon || '🔖'}</span>
                    <div className="truncate">
                      <div className="font-semibold text-gray-800 truncate">{form.name}</div>
                      <div className="text-[10px] text-gray-400 truncate">
                        {form.destinationType === 'page' ? 'Page' : 'Database'}: {form.databaseTitle}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {onEditForm && (
                      <button
                        type="button"
                        onClick={() => onEditForm(form)}
                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-gray-200/60 rounded transition-colors cursor-pointer"
                        title="Edit form"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteForm(form.id)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-gray-200/60 rounded transition-colors cursor-pointer"
                      title="Delete form"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

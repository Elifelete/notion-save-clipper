import React, { useState, useEffect } from 'react';
import { Key, CheckCircle2, AlertCircle, ExternalLink, Trash2, ShieldCheck, Database } from 'lucide-react';
import { getApiKey, setApiKey, getForms, deleteForm } from '../services/storage';
import { validateNotionApiKey } from '../services/notion';
import type { FormConfig } from '../types';

interface SettingsViewProps {
  onApiKeySaved: () => void;
  onNavigateToCreateForm: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onApiKeySaved,
  onNavigateToCreateForm,
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

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) {
      setStatusMessage({ type: 'error', text: 'Insira o token de integração do Notion.' });
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
          text: `Conectado com sucesso! Integração: "${result.botName}".`,
        });
        onApiKeySaved();
      } else {
        setStatusMessage({
          type: 'error',
          text: result.error || 'Token inválido ou sem permissões.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Erro ao conectar à API do Notion.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteForm = async (id: string) => {
    if (confirm('Deseja excluir este formulário?')) {
      await deleteForm(id);
      const updated = await getForms();
      setSavedForms(updated);
    }
  };

  return (
    <div className="p-4 space-y-5 text-gray-800">
      <div>
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <Key className="w-4 h-4 text-blue-600" />
          Conexão com o Notion
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Conecte sua conta do Notion com segurança usando seu token de integração interno.
        </p>
      </div>

      <form onSubmit={handleSaveKey} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Notion Integration Token (API Secret)
          </label>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            className="w-full text-xs px-2.5 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
        </div>

        {statusMessage && (
          <div
            className={`p-2.5 rounded-md text-xs flex items-start gap-2 ${
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
          className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-md shadow-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
        >
          {loading ? 'Validando conexão...' : 'Salvar & Validar Conexão'}
        </button>
      </form>

      {/* Instruções passo a passo */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-[11px] text-gray-600 space-y-1.5">
        <div className="font-semibold text-gray-800 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
          Como obter seu token (100% Gratuito):
        </div>
        <ol className="list-decimal list-inside space-y-1 text-gray-600 pl-0.5">
          <li>
            Acesse{' '}
            <a
              href="https://www.notion.so/my-integrations"
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 underline font-medium inline-flex items-center gap-0.5"
            >
              notion.so/my-integrations <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </li>
          <li>Clique em <b>"Nova Integração"</b> e dê um nome (ex: "Save to Notion").</li>
          <li>Copie o <b>"Internal Integration Secret"</b> e cole acima.</li>
          <li>
            <b>Importante:</b> No Notion, abra a(s) base(s) de dados que deseja salvar, clique nos três pontinhos <b>(...)</b> no topo &gt; <b>Conexões</b> &gt; adicione a sua integração.
          </li>
        </ol>
      </div>

      {/* Formulários Salvos */}
      <div className="pt-2 border-t border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-800 flex items-center gap-1">
            <Database className="w-3.5 h-3.5 text-gray-600" />
            Formulários Criados ({savedForms.length})
          </h3>
          <button
            onClick={onNavigateToCreateForm}
            className="text-[11px] text-blue-600 hover:underline font-medium cursor-pointer"
          >
            + Adicionar
          </button>
        </div>

        {savedForms.length === 0 ? (
          <p className="text-xs text-gray-400 italic">Nenhum formulário configurado ainda.</p>
        ) : (
          <div className="space-y-1.5">
            {savedForms.map((form) => (
              <div
                key={form.id}
                className="flex items-center justify-between p-2 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-xs"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="text-base">{form.icon}</span>
                  <div className="truncate">
                    <p className="font-medium text-gray-800 truncate">{form.name}</p>
                    <p className="text-[10px] text-gray-500 truncate">Base: {form.databaseTitle}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteForm(form.id)}
                  title="Excluir formulário"
                  className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

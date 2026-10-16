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
} from 'lucide-react';
import { getApiKey, setApiKey, getForms, deleteForm } from '../services/storage';
import { validateNotionApiKey } from '../services/notion';
import type { FormConfig } from '../types';

interface SettingsViewProps {
  onApiKeySaved: () => void;
  onNavigateToCreateForm: () => void;
  onBack?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onApiKeySaved,
  onNavigateToCreateForm,
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
    <div className="flex flex-col min-h-[480px] w-full bg-[#f8f9fa] text-xs text-gray-800">
      {/* Top Header com Botão de Voltar e Fechar */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-white border-b border-gray-100">
        <div className="flex items-center gap-1.5">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              title="Voltar"
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-700 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <span className="font-bold text-sm text-gray-900 tracking-tight">Configurações</span>
        </div>

        <button
          type="button"
          onClick={handleClose}
          title="Fechar"
          className="p-1 hover:text-gray-800 hover:bg-gray-100 rounded-full text-gray-400 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4 flex-1">
        {/* Card Conexão com o Notion */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-3.5 space-y-3">
          <div>
            <h2 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-blue-600" />
              Conexão com o Notion
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Conecte sua conta do Notion com segurança usando seu token de integração interno.
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
              {loading ? 'Validando conexão...' : 'Salvar & Validar Conexão'}
            </button>
          </form>
        </div>

        {/* Instruções passo a passo com design limpo */}
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 text-[11px] text-gray-600 space-y-2 shadow-2xs">
          <div className="font-bold text-gray-800 flex items-center gap-1.5 text-xs">
            <ShieldCheck className="w-4 h-4 text-green-600" />
            Como obter seu token (100% Gratuito):
          </div>
          <ol className="list-decimal list-inside space-y-1.5 text-gray-600 pl-0.5 leading-relaxed">
            <li>
              Acesse{' '}
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
              Clique em <b>"New connection"</b> (ou "Nova Conexão") e dê um nome (ex: <i>Save to Notion</i>).
            </li>
            <li>
              Em <b>"Authentication method"</b>, escolha <b>"API token"</b> e clique no botão azul <b>"Create connection"</b>.
            </li>
            <li>
              Copie o código gerado em <b>"Internal Integration Secret"</b> (começa com <code className="bg-gray-100 px-1 py-0.5 rounded text-[10px] text-gray-800 font-mono">secret_...</code>) e cole no campo acima.
            </li>
            <li>
              <b>Importante:</b> No Notion, abra a(s) base(s) de dados ou páginas &gt; clique nos três pontinhos <b>(...)</b> no topo &gt; <b>Conexões</b> &gt; adicione a sua integração.
            </li>
          </ol>
        </div>

        {/* Formulários Salvos */}
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 space-y-2.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-gray-500" />
              Formulários Criados ({savedForms.length})
            </h3>
            <button
              onClick={onNavigateToCreateForm}
              className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline font-semibold cursor-pointer inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>Adicionar</span>
            </button>
          </div>

          {savedForms.length === 0 ? (
            <p className="text-[11px] text-gray-400">Nenhum formulário cadastrado ainda.</p>
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
                        {form.destinationType === 'page' ? 'Página' : 'Database'}: {form.databaseTitle}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteForm(form.id)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                    title="Excluir formulário"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Database, Plus, Check, Loader2, Sparkles, FileText, Bookmark } from 'lucide-react';
import type { NotionDatabase, FormConfig, PropertyFieldMapping, NotionPropertySchema } from '../types';
import { fetchDatabases, getDatabaseSchema } from '../services/notion';
import { saveForm } from '../services/storage';

interface CreateFormViewProps {
  apiKey: string;
  onFormCreated: (form: FormConfig) => void;
  onCancel: () => void;
}

const EMOJI_OPTIONS = ['📑', '📚', '💡', '📌', '🎬', '🍳', '💼', '🚀', '⭐', '🧠'];

export const CreateFormView: React.FC<CreateFormViewProps> = ({
  apiKey,
  onFormCreated,
  onCancel,
}) => {
  const [databases, setDatabases] = useState<NotionDatabase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDatabaseId, setSelectedDatabaseId] = useState<string>('');
  const [selectedDatabase, setSelectedDatabase] = useState<NotionDatabase | null>(null);
  const [formName, setFormName] = useState('Salvar Artigo');
  const [formIcon, setFormIcon] = useState('📑');
  const [clipContent, setClipContent] = useState(true);
  const [mappings, setMappings] = useState<PropertyFieldMapping[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadDatabases() {
      setLoading(true);
      setError(null);
      try {
        const list = await fetchDatabases(apiKey);
        setDatabases(list);
        if (list.length > 0 && list[0]) {
          const first = list[0];
          setSelectedDatabaseId(first.id);
          await loadSchemaForDatabase(first.id);
        }
      } catch (err: any) {
        setError(err.message || 'Falha ao buscar databases no Notion.');
      } finally {
        setLoading(false);
      }
    }

    loadDatabases();
  }, [apiKey]);

  const loadSchemaForDatabase = async (dbId: string) => {
    try {
      const fullDb = await getDatabaseSchema(apiKey, dbId);
      setSelectedDatabase(fullDb);
      setFormName(fullDb.title !== 'Base de Dados sem nome' ? fullDb.title : 'Salvar no Notion');

      // Mapeamento automático inicial inteligente
      const initialMappings: PropertyFieldMapping[] = [];

      for (const [propName, prop] of Object.entries(fullDb.properties)) {
        if (prop.type === 'title') {
          initialMappings.push({
            notionPropertyId: prop.id,
            notionPropertyName: propName,
            notionPropertyType: 'title',
            source: 'page_title',
            showInPopup: true,
            required: true,
          });
        } else if (prop.type === 'url') {
          initialMappings.push({
            notionPropertyId: prop.id,
            notionPropertyName: propName,
            notionPropertyType: 'url',
            source: 'page_url',
            showInPopup: true,
          });
        } else if (
          prop.type === 'rich_text' &&
          (propName.toLowerCase().includes('desc') ||
            propName.toLowerCase().includes('resumo') ||
            propName.toLowerCase().includes('summary') ||
            propName.toLowerCase().includes('nota'))
        ) {
          initialMappings.push({
            notionPropertyId: prop.id,
            notionPropertyName: propName,
            notionPropertyType: 'rich_text',
            source: 'page_description',
            showInPopup: true,
          });
        } else {
          // Outras propriedades são configuráveis
          initialMappings.push({
            notionPropertyId: prop.id,
            notionPropertyName: propName,
            notionPropertyType: prop.type,
            source: 'manual',
            showInPopup: false,
          });
        }
      }

      setMappings(initialMappings);
    } catch (e: any) {
      console.error('Erro ao buscar schema:', e);
    }
  };

  const handleDatabaseChange = async (dbId: string) => {
    setSelectedDatabaseId(dbId);
    await loadSchemaForDatabase(dbId);
  };

  const handleToggleProperty = (propId: string) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.notionPropertyId === propId
          ? { ...m, showInPopup: !m.showInPopup }
          : m
      )
    );
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDatabase) return;

    setSubmitting(true);
    try {
      const newForm: FormConfig = {
        id: crypto.randomUUID(),
        name: formName.trim() || 'Novo Formulário',
        icon: formIcon,
        databaseId: selectedDatabase.id,
        databaseTitle: selectedDatabase.title,
        clipContent,
        mappings,
        createdAt: Date.now(),
      };

      await saveForm(newForm);
      onFormCreated(newForm);
    } catch (err: any) {
      alert(`Erro ao salvar formulário: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-2 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <p className="text-xs">Buscando bases de dados do seu Notion...</p>
      </div>
    );
  }

  if (error || databases.length === 0) {
    return (
      <div className="p-4 space-y-3 text-xs">
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-md">
          <p className="font-semibold mb-1">Nenhuma base de dados encontrada!</p>
          <p className="text-[11px] leading-relaxed">
            Certifique-se de ter compartilhado pelo menos uma Database com a sua integração no Notion.
            <br />
            No Notion, abra sua Database &gt; clique em <b>(...)</b> &gt; <b>Conexões</b> &gt; selecione sua integração.
          </p>
        </div>
        <button
          onClick={onCancel}
          className="w-full py-1.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md cursor-pointer"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSaveForm} className="p-4 space-y-4 text-xs text-gray-800">
      <div>
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-blue-600" />
          Criar Novo Formulário
        </h2>
        <p className="text-gray-500 text-[11px]">
          Defina para qual database e propriedades este formulário enviará os dados.
        </p>
      </div>

      {/* Seleção de Database */}
      <div>
        <label className="block font-medium text-gray-700 mb-1">
          Base de Dados do Notion
        </label>
        <select
          value={selectedDatabaseId}
          onChange={(e) => handleDatabaseChange(e.target.value)}
          className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md bg-white text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
        >
          {databases.map((db) => (
            <option key={db.id} value={db.id}>
              {db.icon} {db.title}
            </option>
          ))}
        </select>
      </div>

      {/* Nome e Ícone do Form */}
      <div className="grid grid-cols-4 gap-2">
        <div className="col-span-3">
          <label className="block font-medium text-gray-700 mb-1">Nome do Formulário</label>
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
            placeholder="Ex: Artigos a Ler"
          />
        </div>
        <div>
          <label className="block font-medium text-gray-700 mb-1">Ícone</label>
          <select
            value={formIcon}
            onChange={(e) => setFormIcon(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-md bg-white text-base text-center focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
          >
            {EMOJI_OPTIONS.map((emoji) => (
              <option key={emoji} value={emoji}>
                {emoji}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Modo de Salvamento: Clip Content vs Bookmark */}
      <div>
        <label className="block font-medium text-gray-700 mb-1">Modo de Salvamento</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setClipContent(true)}
            className={`p-2 rounded-md border text-left flex items-start gap-2 cursor-pointer transition-colors ${
              clipContent
                ? 'border-blue-600 bg-blue-50/50 text-blue-900'
                : 'border-gray-200 hover:bg-gray-50 text-gray-600'
            }`}
          >
            <FileText className={`w-4 h-4 shrink-0 mt-0.5 ${clipContent ? 'text-blue-600' : 'text-gray-400'}`} />
            <div>
              <div className="font-semibold text-[11px]">Extrair Artigo</div>
              <div className="text-[10px] opacity-75">Salva texto e conteúdo no corpo</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setClipContent(false)}
            className={`p-2 rounded-md border text-left flex items-start gap-2 cursor-pointer transition-colors ${
              !clipContent
                ? 'border-blue-600 bg-blue-50/50 text-blue-900'
                : 'border-gray-200 hover:bg-gray-50 text-gray-600'
            }`}
          >
            <Bookmark className={`w-4 h-4 shrink-0 mt-0.5 ${!clipContent ? 'text-blue-600' : 'text-gray-400'}`} />
            <div>
              <div className="font-semibold text-[11px]">Apenas Bookmark</div>
              <div className="text-[10px] opacity-75">Salva apenas link e metadados</div>
            </div>
          </button>
        </div>
      </div>

      {/* Seleção de Propriedades Visíveis no Popup */}
      <div>
        <label className="block font-medium text-gray-700 mb-1">
          Propriedades para Exibir no Popup
        </label>
        <div className="border border-gray-200 rounded-md divide-y divide-gray-100 max-h-36 overflow-y-auto bg-gray-50">
          {mappings.map((mapping) => (
            <label
              key={mapping.notionPropertyId}
              className="flex items-center justify-between p-2 hover:bg-white cursor-pointer text-[11px]"
            >
              <div className="flex items-center gap-2 truncate">
                <input
                  type="checkbox"
                  checked={mapping.showInPopup}
                  disabled={mapping.required}
                  onChange={() => handleToggleProperty(mapping.notionPropertyId)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                />
                <span className="font-medium text-gray-800 truncate">
                  {mapping.notionPropertyName}
                </span>
                <span className="text-[10px] text-gray-400 bg-gray-200/60 px-1.5 py-0.5 rounded">
                  {mapping.notionPropertyType}
                </span>
              </div>
              {mapping.required && (
                <span className="text-[10px] text-amber-600 font-semibold">Obrigatório</span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-1.5 px-3 border border-gray-300 rounded-md font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-xs disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1"
        >
          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Salvar Formulário
        </button>
      </div>
    </form>
  );
};

import React, { useState, useEffect } from 'react';
import { Database, Plus, Check, Loader2, Sparkles, FileText, Bookmark, FolderPlus, ListPlus } from 'lucide-react';
import type { NotionDestination, FormConfig, PropertyFieldMapping, PageSaveMode } from '../types';
import { fetchDestinations, getDatabaseSchema } from '../services/notion';
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
  const [destinations, setDestinations] = useState<NotionDestination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDestinationId, setSelectedDestinationId] = useState<string>('');
  const [selectedDestination, setSelectedDestination] = useState<NotionDestination | null>(null);
  const [pageSaveMode, setPageSaveMode] = useState<PageSaveMode>('subpage');
  const [formName, setFormName] = useState('Salvar Artigo');
  const [formIcon, setFormIcon] = useState('📑');
  const [clipContent, setClipContent] = useState(true);
  const [mappings, setMappings] = useState<PropertyFieldMapping[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const list = await fetchDestinations(apiKey);
        setDestinations(list);
        if (list.length > 0 && list[0]) {
          const first = list[0];
          setSelectedDestinationId(first.id);
          await handleDestinationChange(first.id, list);
        }
      } catch (err: any) {
        setError(err.message || 'Falha ao buscar páginas e databases no Notion.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [apiKey]);

  const handleDestinationChange = async (id: string, listOverride?: NotionDestination[]) => {
    const list = listOverride || destinations;
    const dest = list.find((d) => d.id === id);
    if (!dest) return;

    setSelectedDestinationId(id);
    setSelectedDestination(dest);
    setFormName(dest.title !== 'Base de Dados sem nome' && dest.title !== 'Página sem nome' ? dest.title : 'Salvar no Notion');

    if (dest.type === 'database') {
      try {
        const fullDb = await getDatabaseSchema(apiKey, dest.id);
        const initialMappings: PropertyFieldMapping[] = [];

        if (fullDb.properties) {
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
              initialMappings.push({
                notionPropertyId: prop.id,
                notionPropertyName: propName,
                notionPropertyType: prop.type,
                source: 'manual',
                showInPopup: false,
              });
            }
          }
        }
        setMappings(initialMappings);
      } catch (e: any) {
        console.error('Erro ao buscar schema da database:', e);
      }
    } else {
      // Destino é uma PÁGINA (não tem propriedades customizadas de tabela)
      setMappings([]);
    }
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
    if (!selectedDestination) return;

    setSubmitting(true);
    try {
      const newForm: FormConfig = {
        id: crypto.randomUUID(),
        name: formName.trim() || 'Novo Formulário',
        icon: formIcon,
        destinationType: selectedDestination.type,
        databaseId: selectedDestination.id,
        databaseTitle: selectedDestination.title,
        pageSaveMode: selectedDestination.type === 'page' ? pageSaveMode : undefined,
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
        <p className="text-xs">Buscando páginas e bases de dados do Notion...</p>
      </div>
    );
  }

  if (error || destinations.length === 0) {
    return (
      <div className="p-4 space-y-3 text-xs">
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-md">
          <p className="font-semibold mb-1">Nenhum local encontrado no Notion!</p>
          <p className="text-[11px] leading-relaxed">
            Certifique-se de ter compartilhado pelo menos uma Página ou Database com a sua integração no Notion.
            <br />
            No Notion, abra sua Página ou Database &gt; clique em <b>(...)</b> &gt; <b>Conexões</b> &gt; selecione sua integração.
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

  const databaseDestinations = destinations.filter((d) => d.type === 'database');
  const pageDestinations = destinations.filter((d) => d.type === 'page');

  return (
    <form onSubmit={handleSaveForm} className="p-4 space-y-3.5 text-xs text-gray-800">
      <div>
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-blue-600" />
          Criar Novo Formulário
        </h2>
        <p className="text-gray-500 text-[11px]">
          Escolha salvar dentro de uma Database ou diretamente em uma Página do Notion.
        </p>
      </div>

      {/* Seleção de Destino: Database ou Página */}
      <div>
        <label className="block font-medium text-gray-700 mb-1">
          Destino no Notion (Database ou Página)
        </label>
        <select
          value={selectedDestinationId}
          onChange={(e) => handleDestinationChange(e.target.value)}
          className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md bg-white text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
        >
          {databaseDestinations.length > 0 && (
            <optgroup label="📁 Bases de Dados (Databases)">
              {databaseDestinations.map((db) => (
                <option key={db.id} value={db.id}>
                  {db.icon} {db.title}
                </option>
              ))}
            </optgroup>
          )}

          {pageDestinations.length > 0 && (
            <optgroup label="📄 Páginas (Pages)">
              {pageDestinations.map((pg) => (
                <option key={pg.id} value={pg.id}>
                  {pg.icon} {pg.title}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* Se o destino for uma PÁGINA, escolha entre Sub-página ou Inserir no final */}
      {selectedDestination?.type === 'page' && (
        <div className="bg-blue-50/60 border border-blue-200 rounded-md p-2.5 space-y-2">
          <label className="block font-semibold text-blue-900 text-[11px]">
            Como salvar nesta Página?
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPageSaveMode('subpage')}
              className={`p-2 rounded-md border text-left flex items-start gap-1.5 cursor-pointer transition-colors ${
                pageSaveMode === 'subpage'
                  ? 'border-blue-600 bg-white shadow-xs text-blue-950 font-medium'
                  : 'border-blue-200/60 bg-white/50 text-gray-600 hover:bg-white'
              }`}
            >
              <FolderPlus className={`w-4 h-4 shrink-0 mt-0.5 ${pageSaveMode === 'subpage' ? 'text-blue-600' : 'text-gray-400'}`} />
              <div>
                <div className="text-[11px] font-semibold">Sub-página</div>
                <div className="text-[10px] text-gray-500">Cria página filha com capa e conteúdo</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setPageSaveMode('append_block')}
              className={`p-2 rounded-md border text-left flex items-start gap-1.5 cursor-pointer transition-colors ${
                pageSaveMode === 'append_block'
                  ? 'border-blue-600 bg-white shadow-xs text-blue-950 font-medium'
                  : 'border-blue-200/60 bg-white/50 text-gray-600 hover:bg-white'
              }`}
            >
              <ListPlus className={`w-4 h-4 shrink-0 mt-0.5 ${pageSaveMode === 'append_block' ? 'text-blue-600' : 'text-gray-400'}`} />
              <div>
                <div className="text-[11px] font-semibold">No final da página</div>
                <div className="text-[10px] text-gray-500">Insere o link e resumo no texto atual</div>
              </div>
            </button>
          </div>
        </div>
      )}

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
        <label className="block font-medium text-gray-700 mb-1">Extração de Conteúdo</label>
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
              <div className="text-[10px] opacity-75">Salva resumo e corpo da página</div>
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

      {/* Seleção de Propriedades Visíveis no Popup (apenas para Database) */}
      {selectedDestination?.type === 'database' ? (
        <div>
          <label className="block font-medium text-gray-700 mb-1">
            Propriedades da Database para Exibir no Popup
          </label>
          <div className="border border-gray-200 rounded-md divide-y divide-gray-100 max-h-32 overflow-y-auto bg-gray-50">
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
      ) : (
        <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-md text-[11px] text-gray-500">
          💡 <b>Destino em Página:</b> Páginas do Notion não possuem colunas de tabela (Tags, Status), mas salvarão com fidelidade o <b>Título</b>, a <b>URL</b>, a <b>Imagem de Capa</b> e o <b>Conteúdo</b>!
        </div>
      )}

      {/* Ações */}
      <div className="flex items-center gap-2 pt-1 border-t border-gray-200">
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

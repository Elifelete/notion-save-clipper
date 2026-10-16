import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  Database,
  FileText,
  Bookmark,
  FolderPlus,
  ListPlus,
  Loader2,
  Check,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import type { NotionDestination, FormConfig, PropertyFieldMapping, PageSaveMode } from '../types';
import { fetchDestinations, getDatabaseSchema } from '../services/notion';
import { saveForm } from '../services/storage';

interface CreateFormViewProps {
  apiKey: string;
  onFormCreated: (form: FormConfig) => void;
  onCancel: () => void;
}

const EMOJI_OPTIONS = ['📑', '📚', '💡', '📌', '🎬', '🍳', '💼', '🚀', '⭐', '🧠'];

type FilterType = 'all' | 'database' | 'page';

export const CreateFormView: React.FC<CreateFormViewProps> = ({
  apiKey,
  onFormCreated,
  onCancel,
}) => {
  const [destinations, setDestinations] = useState<NotionDestination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estado da navegação interna: 'select_location' -> 'configure_form'
  const [step, setStep] = useState<'select_location' | 'configure_form'>('select_location');

  // Busca e Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');

  // Destino selecionado
  const [selectedDestination, setSelectedDestination] = useState<NotionDestination | null>(null);

  // Configuração do formulário
  const [formName, setFormName] = useState('Salvar Artigo');
  const [formIcon, setFormIcon] = useState('📑');
  const [pageSaveMode, setPageSaveMode] = useState<PageSaveMode>('subpage');
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
      } catch (err: any) {
        setError(err.message || 'Falha ao buscar páginas e databases no Notion.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [apiKey]);

  // Filtra itens com base na pesquisa e no seletor Viewing
  const filteredDestinations = useMemo(() => {
    return destinations.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.path && item.path.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (filterType === 'database') return item.type === 'database';
      if (filterType === 'page') return item.type === 'page';
      return true;
    });
  }, [destinations, searchQuery, filterType]);

  const databaseItems = useMemo(
    () => filteredDestinations.filter((d) => d.type === 'database'),
    [filteredDestinations]
  );
  const pageItems = useMemo(
    () => filteredDestinations.filter((d) => d.type === 'page'),
    [filteredDestinations]
  );

  const handleSelectLocation = async (dest: NotionDestination) => {
    setSelectedDestination(dest);
    setFormName(dest.title !== 'Base de Dados sem nome' && dest.title !== 'Página sem nome' ? dest.title : 'Salvar no Notion');

    if (dest.type === 'database') {
      try {
        const fullDb = await getDatabaseSchema(apiKey, dest.id);
        const initialMappings: PropertyFieldMapping[] = [];

        if (fullDb.properties) {
          for (const [propName, prop] of Object.entries(fullDb.properties)) {
            const propOptions = prop.select?.options || prop.multi_select?.options || prop.status?.options;

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
                options: propOptions,
                showInPopup: true, // Habilitado para facilitar tags, status, checkboxes
              });
            }
          }
        }
        setMappings(initialMappings);
      } catch (e: any) {
        console.error('Erro ao buscar schema da database:', e);
      }
    } else {
      setMappings([]);
    }

    setStep('configure_form');
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
      <div className="flex flex-col items-center justify-center p-12 space-y-2 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <p className="text-xs">Buscando databases e páginas do seu Notion...</p>
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
            No Notion, abra sua Página ou Database &gt; clique em <b>(...)</b> &gt; <b>Conexões</b> &gt; adicione a sua integração.
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

  // TELA 1: Select a Save Location (Idêntica ao Save.to)
  if (step === 'select_location') {
    return (
      <div className="p-3.5 space-y-3 text-xs text-gray-800">
        {/* Header com navegação e título */}
        <div className="flex items-center justify-between pb-1 border-b border-gray-100">
          <button
            onClick={onCancel}
            className="flex items-center gap-1 text-gray-500 hover:text-black font-medium transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar</span>
          </button>
          <div className="text-center font-semibold text-sm text-gray-900">
            Select a Save Location
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <span>Notion</span>
          </div>
        </div>

        {/* Barra de Busca */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search databases and pages..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        {/* Filtro: Viewing Databases & Pages */}
        <div className="flex items-center justify-between px-1 text-[11px] text-gray-500">
          <span>Viewing</span>
          <div className="relative">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as FilterType)}
              className="bg-blue-50 text-blue-700 font-medium rounded-md px-2 py-1 border border-blue-200 text-[11px] appearance-none pr-6 cursor-pointer focus:outline-none"
            >
              <option value="all">Databases & Pages</option>
              <option value="database">Databases only</option>
              <option value="page">Pages only</option>
            </select>
            <ChevronDown className="w-3 h-3 absolute right-1.5 top-2 text-blue-700 pointer-events-none" />
          </div>
        </div>

        {/* Lista de Resultados */}
        <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
          {filteredDestinations.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-xs">
              Nenhuma base ou página encontrada para "{searchQuery}".
            </div>
          ) : (
            <>
              {/* Grupo Databases */}
              {databaseItems.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-1">
                    Databases ({databaseItems.length})
                  </div>
                  <div className="space-y-1">
                    {databaseItems.map((db) => (
                      <button
                        key={db.id}
                        type="button"
                        onClick={() => handleSelectLocation(db)}
                        className="w-full flex items-center gap-2.5 p-2 rounded-lg border border-transparent hover:border-gray-200 hover:bg-gray-50 transition-all text-left cursor-pointer group"
                      >
                        <span className="text-base shrink-0 p-1 bg-gray-100 rounded-md group-hover:bg-white transition-colors">
                          {db.icon || '📁'}
                        </span>
                        <div className="truncate flex-1">
                          <div className="font-semibold text-gray-900 truncate text-xs">
                            {db.title}
                          </div>
                          <div className="text-[10px] text-gray-400 truncate">
                            {db.path || 'Workspace'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Grupo Pages */}
              {pageItems.length > 0 && (
                <div className="space-y-1 pt-1">
                  <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-1">
                    Pages ({pageItems.length})
                  </div>
                  <div className="space-y-1">
                    {pageItems.map((pg) => (
                      <button
                        key={pg.id}
                        type="button"
                        onClick={() => handleSelectLocation(pg)}
                        className="w-full flex items-center gap-2.5 p-2 rounded-lg border border-transparent hover:border-gray-200 hover:bg-gray-50 transition-all text-left cursor-pointer group"
                      >
                        <span className="text-base shrink-0 p-1 bg-gray-100 rounded-md group-hover:bg-white transition-colors">
                          {pg.icon || '📄'}
                        </span>
                        <div className="truncate flex-1">
                          <div className="font-semibold text-gray-900 truncate text-xs">
                            {pg.title}
                          </div>
                          <div className="text-[10px] text-gray-400 truncate">
                            {pg.path || 'Workspace'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // TELA 2: Configure Form (Ajuste de Nome, Ícone, Propriedades e Modo de Salvamento)
  return (
    <form onSubmit={handleSaveForm} className="p-4 space-y-3.5 text-xs text-gray-800">
      <div>
        <div className="flex items-center justify-between mb-1">
          <button
            type="button"
            onClick={() => setStep('select_location')}
            className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline font-medium cursor-pointer"
          >
            ← Trocar Local
          </button>
          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
            Passo 2 de 2
          </span>
        </div>
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-blue-600" />
          Configurar Formulário
        </h2>
      </div>

      {/* Cartão do Destino Escolhido */}
      {selectedDestination && (
        <div
          onClick={() => setStep('select_location')}
          className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2 truncate">
            <span className="text-base">{selectedDestination.icon || '📁'}</span>
            <div className="truncate">
              <div className="font-semibold text-gray-900 text-xs truncate">
                {selectedDestination.title}
              </div>
              <div className="text-[10px] text-gray-500 truncate">
                {selectedDestination.path} • {selectedDestination.type === 'database' ? 'Database' : 'Página'}
              </div>
            </div>
          </div>
          <span className="text-[11px] text-blue-600 font-medium shrink-0 ml-2">
            Alterar
          </span>
        </div>
      )}

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
      ) : (
        <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-md text-[11px] text-gray-500">
          💡 <b>Destino em Página:</b> Salvará com fidelidade o <b>Título</b>, a <b>URL</b>, a <b>Imagem de Capa</b> e o <b>Conteúdo</b>!
        </div>
      )}

      {/* Ações */}
      <div className="flex items-center gap-2 pt-1 border-t border-gray-200">
        <button
          type="button"
          onClick={() => setStep('select_location')}
          className="flex-1 py-1.5 px-3 border border-gray-300 rounded-md font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
        >
          Voltar
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

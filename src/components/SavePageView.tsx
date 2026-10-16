import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Settings,
  Plus,
  Bookmark,
  FileText,
  Scissors,
  Check,
  Sparkles,
  History,
  X,
  Type,
  AlignLeft,
  Link2,
  Image as ImageIcon,
} from 'lucide-react';
import type { FormConfig, ExtractedMetadata } from '../types';
import { createPage } from '../services/notion';
import { getActiveTabArticle, detectSpecialPage, type ArticleParsedContent } from '../services/reader';
import { CoverImagePicker } from './CoverImagePicker';
import { PropertyField } from './PropertyField';
import { saveForm } from '../services/storage'; import type { NotionPropertyOption } from '../types'; 

interface SavePageViewProps {
  apiKey: string;
  form: FormConfig;
  metadata: ExtractedMetadata;
  onBackToSelectForm: () => void;
  onOpenSettings: () => void;
}

export const SavePageView: React.FC<SavePageViewProps> = ({
  apiKey,
  form,
  metadata,
  onBackToSelectForm,
  onOpenSettings,
}) => {
  const [title, setTitle] = useState(metadata.title || '');
  const [url, setUrl] = useState(metadata.url || '');
  const [description, setDescription] = useState(metadata.description || '');
  const [coverUrl, setCoverUrl] = useState<string | undefined>(metadata.coverImage);
  const [iconUrl, setIconUrl] = useState<string | undefined>(metadata.favicon);
  const [propertyValues, setPropertyValues] = useState<Record<string, any>>({});

  // Clip Action: 'bookmark' | 'content' | 'selection'
  const [clipAction, setClipAction] = useState<'bookmark' | 'content' | 'selection'>(
    form.clipContent ? 'content' : 'bookmark'
  );

  // Expansão de campos extras (Save.to: "⌵ 4 more fields")
  const [showMoreFields, setShowMoreFields] = useState(false);
  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false);

  // Extração de artigo
  const [articleData, setArticleData] = useState<ArticleParsedContent | null>(null);
  const [loadingArticle, setLoadingArticle] = useState(false);

  const [saving, setSaving] = useState(false);
  const [savedPageInfo, setSavedPageInfo] = useState<{ id: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOptionsUpdate = async (propertyId: string, newOptions: NotionPropertyOption[]) => {
    try {
      const updatedMappings = (form.mappings || []).map((m) =>
        m.notionPropertyId === propertyId ? { ...m, options: newOptions } : m
      );
      const updatedForm = { ...form, mappings: updatedMappings };
      await saveForm(updatedForm);
    } catch (err) {
      console.warn("Falha ao persistir opções no formulário:", err);
    }
  };

  const specialType = detectSpecialPage(url);
  const draftKey = `notion_save_draft_${form.id}_${metadata.url || url}`;

  // Inicializa dados e restaura rascunho persistido para evitar perda ao clicar fora
  useEffect(() => {
    let initialTitle = metadata.title || '';
    let initialUrl = metadata.url || '';
    let initialDesc = metadata.description || '';
    let initialCover = metadata.coverImage;
    let initialIcon = metadata.favicon;
    let initialClip = form.clipContent ? ('content' as const) : ('bookmark' as const);
    const initialProps: Record<string, any> = {};

    if (form.mappings) {
      for (const m of form.mappings) {
        if (m.defaultValue !== undefined) {
          initialProps[m.notionPropertyId] = m.defaultValue;
        }
      }
    }

    // Tenta restaurar rascunho salvo anteriormente
    try {
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed.title) initialTitle = parsed.title;
        if (parsed.url) initialUrl = parsed.url;
        if (parsed.description !== undefined) initialDesc = parsed.description;
        if (parsed.coverUrl !== undefined) initialCover = parsed.coverUrl;
        if (parsed.clipAction) initialClip = parsed.clipAction;
        if (parsed.propertyValues) Object.assign(initialProps, parsed.propertyValues);
      }
    } catch (e) {
      // Ignora erro de parsing
    }

    setTitle(initialTitle);
    setUrl(initialUrl);
    setDescription(initialDesc);
    setCoverUrl(initialCover);
    setIconUrl(initialIcon);
    setClipAction(initialClip);
    setPropertyValues(initialProps);
    setSavedPageInfo(null);
    setError(null);

    // Pré-carrega artigo se necessário
    if (form.clipContent) {
      setLoadingArticle(true);
      getActiveTabArticle()
        .then((art) => {
          if (art) {
            setArticleData(art);
            if (art.excerpt && !initialDesc) {
              setDescription(art.excerpt);
            }
          }
        })
        .finally(() => {
          setLoadingArticle(false);
        });
    }
  }, [metadata, form, draftKey]);

  // Persiste rascunho a cada alteração
  useEffect(() => {
    if (!title && !description) return;
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          title,
          url,
          description,
          coverUrl,
          clipAction,
          propertyValues,
        })
      );
    } catch (e) {
      // Ignore
    }
  }, [title, url, description, coverUrl, clipAction, propertyValues, draftKey]);

  const handlePropertyValueChange = (propertyId: string, val: any) => {
    setPropertyValues((prev) => ({
      ...prev,
      [propertyId]: val,
    }));
  };

  const handleClose = () => {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ action: 'NOTION_SAVE_CLOSE' }, '*');
    }
    window.close();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('O título da página é obrigatório.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const propertiesPayload: Record<string, { type: string; value: any }> = {};

      if (form.destinationType === 'database' && form.mappings) {
        for (const mapping of form.mappings) {
          let val: any = null;

          if (mapping.source === 'page_title' || mapping.notionPropertyType === 'title') {
            val = title;
          } else if (mapping.source === 'page_url' || mapping.notionPropertyType === 'url') {
            val = url;
          } else if (mapping.source === 'page_description') {
            val = description;
          } else if (propertyValues[mapping.notionPropertyId] !== undefined) {
            val = propertyValues[mapping.notionPropertyId];
          }

          if (val !== null && val !== undefined && val !== '') {
            propertiesPayload[mapping.notionPropertyName] = {
              type: mapping.notionPropertyType,
              value: val,
            };
          }
        }
      }

      // CORREÇÃO: Verifica se a propriedade 'Description' já está sendo salva na coluna da tabela do Notion
      const hasDescriptionPropertyInDatabase = Object.keys(propertiesPayload).some(
        (key) =>
          key.toLowerCase() === 'description' ||
          key.toLowerCase() === 'descrição' ||
          key.toLowerCase() === 'descricao' ||
          key.toLowerCase() === 'resumo'
      );

      // Preparação dos blocos
      const contentBlocks: any[] = [];

      if (specialType === 'youtube' && url) {
        contentBlocks.push({
          object: 'block',
          type: 'video',
          video: {
            type: 'external',
            external: { url },
          },
        });
        // Só adiciona como bloco de citação se a tabela NÃO tiver a coluna Description
        if (description && !hasDescriptionPropertyInDatabase) {
          contentBlocks.push({
            object: 'block',
            type: 'quote',
            quote: {
              rich_text: [{ type: 'text', text: { content: description } }],
            },
          });
        }
      } else if (clipAction === 'content' && articleData && articleData.blocks.length > 0) {
        contentBlocks.push(...articleData.blocks);
      } else {
        if (url) {
          contentBlocks.push({
            object: 'block',
            type: 'bookmark',
            bookmark: { url },
          });
        }
        // No modo Bookmark, se a Description já foi salva como propriedade da tabela, NÃO duplica no corpo!
        if (description && !hasDescriptionPropertyInDatabase) {
          contentBlocks.push({
            object: 'block',
            type: 'quote',
            quote: {
              rich_text: [{ type: 'text', text: { content: description } }],
            },
          });
        }
      }

      const result = await createPage({
        apiKey,
        destinationType: form.destinationType || 'database',
        destinationId: form.databaseId,
        pageSaveMode: form.pageSaveMode || 'subpage',
        title: title.trim(),
        url: url.trim(),
        description: description.trim(),
        properties: propertiesPayload,
        coverUrl,
        iconUrl,
        contentBlocks: contentBlocks.length > 0 ? contentBlocks : undefined,
      });

      // Limpa rascunho após salvar com sucesso
      try {
        localStorage.removeItem(draftKey);
      } catch (e) {
        // Ignore
      }

      setSavedPageInfo(result);
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar no Notion.');
    } finally {
      setSaving(false);
    }
  };

  // Mapeamentos específicos da database
  const tagMapping = form.mappings?.find(
    (m) => m.notionPropertyType === 'multi_select' || m.notionPropertyType === 'select'
  );

  const customDatabaseMappings = form.mappings?.filter(
    (m) =>
      m.notionPropertyType !== 'title' &&
      m.notionPropertyType !== 'url' &&
      m.notionPropertyId !== tagMapping?.notionPropertyId &&
      m.source !== 'page_description'
  ) || [];

  return (
    <div className="flex flex-col min-h-[480px] w-full bg-[#f8f9fa] text-xs text-gray-800">
      {/* Top Header Estilo Save.to */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-white border-b border-gray-100">
        <span className="font-bold text-sm text-gray-900 tracking-tight">Notion Save</span>
        <div className="flex items-center gap-2 text-gray-500">
          <button
            type="button"
            title="Dicas & Atalhos"
            className="p-1 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Histórico de Páginas Salvas"
            className="p-1 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
          >
            <History className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleClose}
            title="Fechar"
            className="p-1 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Barra de Navegação do Formulário: [<] [🔖 Form Name] [🔗] [⚙️] */}
      <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-gray-200">
        <button
          type="button"
          onClick={onBackToSelectForm}
          title="Trocar de Formulário"
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-700 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-1.5 font-bold text-sm text-gray-900 truncate max-w-[200px]">
          <span className="text-base">{form.icon || '🔖'}</span>
          <span className="truncate">{form.name}</span>
        </div>

        <div className="flex items-center gap-0.5">
          <a
            href={form.destinationUrl || `https://www.notion.so/${form.databaseId.replace(/-/g, '')}`}
            target="_blank"
            rel="noreferrer"
            title="Abrir no Notion em nova aba"
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            type="button"
            onClick={onOpenSettings}
            title="Configurações do Formulário"
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
        <div className="space-y-3">
          {/* Campo 1: Name * (Aa Name *) */}
          <div className="space-y-1">
            <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-600">
              <Type className="w-3.5 h-3.5 text-gray-400" />
              <span>Name</span>
              <span className="text-gray-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
              placeholder="ctresb/leis: Todas as leis do Brasil"
              required
            />
          </div>

          {/* Campo 2: Tags (⋮≡ Tags) */}
          {tagMapping && (
            <PropertyField
              mapping={tagMapping}
              value={propertyValues[tagMapping.notionPropertyId]}
              onChange={(val) => handlePropertyValueChange(tagMapping.notionPropertyId, val)}
              apiKey={apiKey}
              databaseId={form.databaseId}
              onOptionsUpdate={handleOptionsUpdate}
            />
          )}

          {/* Campo 3: Description (≡ Description) */}
          <div className="space-y-1">
            <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-600">
              <AlignLeft className="w-3.5 h-3.5 text-gray-400" />
              <span>Description</span>
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Empty"
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs resize-none"
            />
          </div>

          {/* Campos Ocultos / Expandíveis (Save.to: "⌵ 4 more fields") */}
          {showMoreFields ? (
            <div className="space-y-3 pt-1 border-t border-gray-100 animate-fadeIn">
              {/* Content Image (🖼️ Content Image) */}
              <div className="space-y-1">
                <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-600">
                  <ImageIcon className="w-3.5 h-3.5 text-gray-400" />
                  <span>Content Image</span>
                </label>
                <div className="flex items-center gap-2">
                  <div
                    onClick={() => setIsCoverPickerOpen(true)}
                    className="w-12 h-12 rounded-lg border border-gray-200 bg-gray-100 hover:bg-gray-200 flex items-center justify-center cursor-pointer overflow-hidden transition-colors shadow-2xs group relative"
                  >
                    {coverUrl ? (
                      <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                      <Plus className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
                    )}
                  </div>
                  {coverUrl && (
                    <button
                      type="button"
                      onClick={() => setCoverUrl(undefined)}
                      className="text-[10px] text-gray-400 hover:text-red-500 underline cursor-pointer"
                    >
                      Remover Imagem
                    </button>
                  )}
                </div>
              </div>

              {/* Icon (🖼️ Icon) */}
              <div className="space-y-1">
                <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-600">
                  <ImageIcon className="w-3.5 h-3.5 text-gray-400" />
                  <span>Icon</span>
                </label>
                <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center p-1.5 shadow-2xs">
                  {iconUrl ? (
                    <img
                      src={iconUrl}
                      alt="Icon"
                      className="w-6 h-6 object-contain rounded"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span className="text-white text-xs font-bold">N</span>
                  )}
                </div>
              </div>

              {/* URL * (🔗 URL *) */}
              <div className="space-y-1">
                <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-600">
                  <Link2 className="w-3.5 h-3.5 text-gray-400" />
                  <span>URL</span>
                  <span className="text-gray-400">*</span>
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                  placeholder="https://..."
                />
              </div>

              {/* Clip Action (📄 Clip Action - Opções Estilo Save.to) */}
              <div className="space-y-1">
                <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-600">
                  <FileText className="w-3.5 h-3.5 text-gray-400" />
                  <span>Clip Action</span>
                </label>

                <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100 shadow-2xs overflow-hidden">
                  {/* Opção 1: Bookmark */}
                  <label
                    onClick={() => setClipAction('bookmark')}
                    className={`flex items-center justify-between p-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${
                      clipAction === 'bookmark' ? 'bg-blue-50/40 text-blue-900 font-semibold' : 'text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Bookmark className={`w-3.5 h-3.5 ${clipAction === 'bookmark' ? 'text-blue-600' : 'text-gray-400'}`} />
                      <span className="text-[11px]">Bookmark</span>
                    </div>
                    {clipAction === 'bookmark' ? (
                      <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-white">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-gray-300" />
                    )}
                  </label>

                  {/* Opção 2: Save Webpage Content */}
                  <label
                    onClick={() => setClipAction('content')}
                    className={`flex items-center justify-between p-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${
                      clipAction === 'content' ? 'bg-blue-50/40 text-blue-900 font-semibold' : 'text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className={`w-3.5 h-3.5 ${clipAction === 'content' ? 'text-blue-600' : 'text-gray-400'}`} />
                      <div>
                        <div className="text-[11px]">Save Webpage Content</div>
                        {articleData && (
                          <div className="text-[10px] text-blue-600 font-normal">
                            ~{articleData.readingTimeMinutes} min • {articleData.wordCount} palavras
                          </div>
                        )}
                      </div>
                    </div>
                    {clipAction === 'content' ? (
                      <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-white">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-gray-300" />
                    )}
                  </label>

                  {/* Opção 3: Save custom area on webpage */}
                  <label
                    onClick={() => setClipAction('selection')}
                    className={`flex items-center justify-between p-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${
                      clipAction === 'selection' ? 'bg-blue-50/40 text-blue-900 font-semibold' : 'text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Scissors className={`w-3.5 h-3.5 ${clipAction === 'selection' ? 'text-blue-600' : 'text-gray-400'}`} />
                      <span className="text-[11px]">Save custom area on webpage</span>
                    </div>
                    {clipAction === 'selection' ? (
                      <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-white">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-gray-300" />
                    )}
                  </label>
                </div>
              </div>

              {/* Demais Propriedades Customizadas da Database */}
              {customDatabaseMappings.map((mapping) => (
                <PropertyField
                  key={mapping.notionPropertyId}
                  mapping={mapping}
                  value={propertyValues[mapping.notionPropertyId]}
                  onChange={(val) => handlePropertyValueChange(mapping.notionPropertyId, val)}
                  apiKey={apiKey}
                  databaseId={form.databaseId}
                  onOptionsUpdate={handleOptionsUpdate}
                />
              ))}

              {/* Botão para Ocultar os Campos Extras */}
              <button
                type="button"
                onClick={() => setShowMoreFields(false)}
                className="w-full flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-800 cursor-pointer pt-1"
              >
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Hide 4 fields</span>
              </button>
            </div>
          ) : (
            /* Botão de Expandir Campos Extras (Save.to: "⌵ 4 more fields") */
            <button
              type="button"
              onClick={() => setShowMoreFields(true)}
              className="w-full flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-800 cursor-pointer pt-1"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              <span>4 more fields</span>
            </button>
          )}
        </div>

        {/* Modal de Escolher Imagem de Capa se Aberto */}
        {isCoverPickerOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-3 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <span className="font-semibold text-xs text-gray-900">Selecionar Imagem</span>
                <button
                  type="button"
                  onClick={() => setIsCoverPickerOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <CoverImagePicker
                coverUrl={coverUrl}
                onSelectCover={(url) => {
                  setCoverUrl(url);
                  setIsCoverPickerOpen(false);
                }}
              />
            </div>
          </div>
        )}

        {/* Feedback de Erro */}
        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Feedback de Sucesso */}
        {savedPageInfo && (
          <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-xs rounded-lg space-y-1.5 animate-fadeIn">
            <div className="flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span>Salvo com sucesso no Notion!</span>
            </div>
            <a
              href={savedPageInfo.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-800 hover:underline"
            >
              Abrir no Notion <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Botão de Ação: Save to Notion ⌵ */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={saving || loadingArticle}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-between cursor-pointer disabled:opacity-50"
          >
            <div className="w-4" />
            <div className="flex items-center gap-1.5">
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving to Notion...</span>
                </>
              ) : (
                <span>Save to Notion</span>
              )}
            </div>
            <ChevronDown className="w-4 h-4 opacity-75" />
          </button>
        </div>
      </form>
    </div>
  );
};

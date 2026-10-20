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
  Camera,
  AlertTriangle,
  Highlighter,
} from 'lucide-react';
import type { FormConfig, ExtractedMetadata } from '../types';
import { createPage, findExistingPageByUrl } from '../services/notion';
import { getActiveTabArticle, detectSpecialPage, type ArticleParsedContent } from '../services/reader';
import { CoverImagePicker } from './CoverImagePicker';
import { PropertyField } from './PropertyField';
import { saveForm } from '../services/storage';
import type { NotionPropertyOption } from '../types';

interface SavePageViewProps {
  apiKey: string;
  form: FormConfig;
  metadata: ExtractedMetadata;
  onBackToSelectForm: () => void;
  onOpenSettings: () => void;
  onEditForm?: (form: FormConfig) => void;
}

export const SavePageView: React.FC<SavePageViewProps> = ({
  apiKey,
  form,
  metadata,
  onBackToSelectForm,
  onOpenSettings,
  onEditForm,
}) => {
  const [title, setTitle] = useState(metadata.title || '');
  const [url, setUrl] = useState(metadata.url || '');
  const [description, setDescription] = useState(metadata.description || '');
  const [coverUrl, setCoverUrl] = useState<string | undefined>(metadata.coverImage);
  const [iconUrl, setIconUrl] = useState<string | undefined>(metadata.favicon);
  const [propertyValues, setPropertyValues] = useState<Record<string, any>>({});

  const specialType = detectSpecialPage(url || metadata.url || '');
  const isSocialPost = !!metadata.socialPost || specialType === 'twitter' || specialType === 'instagram';

  // Clip Action: 'bookmark' | 'content' | 'selection'
  const [clipAction, setClipAction] = useState<'bookmark' | 'content' | 'selection'>(
    isSocialPost || form.clipContent ? 'content' : 'bookmark'
  );

  // Expansão de campos extras (Save.to: "⌅ 4 more fields")
  const [showMoreFields, setShowMoreFields] = useState(false);
  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false);

  // Extração de artigo
  const [articleData, setArticleData] = useState<ArticleParsedContent | null>(null);
  const [loadingArticle, setLoadingArticle] = useState(false);

  const [saving, setSaving] = useState(false);
  const [savedPageInfo, setSavedPageInfo] = useState<{ id: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Detecção de página já salva (Anti-duplicidade)
  const [existingPage, setExistingPage] = useState<{ id: string; url: string; title: string } | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(false);

  // Captura de tela ativa (Screenshot)
  const [capturingScreenshot, setCapturingScreenshot] = useState(false);

  // Trecho selecionado / Highlighter
  const [selectedHighlight, setSelectedHighlight] = useState<string>(metadata.selectedText || '');

  const handleOptionsUpdate = async (propertyId: string, newOptions: NotionPropertyOption[]) => {
    try {
      const updatedMappings = (form.mappings || []).map((m) =>
        m.notionPropertyId === propertyId ? { ...m, options: newOptions } : m
      );
      const updatedForm = { ...form, mappings: updatedMappings };
      await saveForm(updatedForm);
    } catch (err) {
      console.warn('Falha ao persistir opções no formulário:', err);
    }
  };

  // Permite cancelar o seletor mesmo se o foco estiver dentro do iframe ao pressionar ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.code === 'Escape' || e.keyCode === 27) {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ action: 'NOTION_SAVE_STOP_ELEMENT_PICKER' }, '*');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Escuta mensagem de seleção ou seletor de elemento do content script
  useEffect(() => {
    const handleMsg = (event: MessageEvent) => {
      if (event.data?.action === 'NOTION_SAVE_SET_SELECTION' && event.data.selectedText) {
        const text = String(event.data.selectedText).trim();
        setSelectedHighlight(text);
        setDescription((prev) => (prev ? prev + '\n\n"' + text + '"' : '"' + text + '"'));
        setClipAction('selection');
      }

      if (event.data?.action === 'NOTION_SAVE_SET_CUSTOM_AREA' && event.data.text) {
        const text = String(event.data.text).trim();
        setSelectedHighlight(text);
        setDescription((prev) => (prev ? prev + '\n\n"' + text + '"' : text));
        setClipAction('selection');
      }
    };

    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, []);

  const handleStartCustomAreaPicker = () => {
    setClipAction('selection');
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ action: 'NOTION_SAVE_START_ELEMENT_PICKER' }, '*');
    }
  };

  // Verifica se o link já foi salvo (se a opção detectExisting estiver ativa no formulário)
  useEffect(() => {
    if (form.detectExisting === false) return;
    if (!url || !url.startsWith('http')) return;

    let isMounted = true;
    async function checkDuplicate() {
      try {
        setCheckingExisting(true);
        const match = await findExistingPageByUrl(
          apiKey,
          form.databaseId,
          form.destinationType || 'database',
          url
        );
        if (isMounted) {
          setExistingPage(match);
        }
      } catch (err) {
        console.warn('Erro ao checar duplicidade:', err);
      } finally {
        if (isMounted) {
          setCheckingExisting(false);
        }
      }
    }

    checkDuplicate();
    return () => {
      isMounted = false;
    };
  }, [url, form.databaseId, form.destinationType, form.detectExisting, apiKey]);

  const draftKey = `notion_save_draft_${form.id}_${metadata.url || url}`;

  // Inicializa dados e restaura rascunho persistido para evitar perda ao clicar fora
  useEffect(() => {
    let initialTitle = metadata.title || '';
    let initialUrl = metadata.url || '';
    let initialDesc = metadata.description || '';
    let initialCover = metadata.coverImage;
    let initialIcon = metadata.favicon;
    const isSocial = !!metadata.socialPost || specialType === 'twitter' || specialType === 'instagram';
    let initialClip = isSocial ? ('content' as const) : (form.clipContent ? ('content' as const) : ('bookmark' as const));
    const initialProps: Record<string, any> = {};

    if (form.mappings) {
      for (const m of form.mappings) {
        if (m.defaultValue !== undefined) {
          initialProps[m.notionPropertyId] = m.defaultValue;
        }
      }
    }

    // Tenta restaurar rascunho salvo anteriormente (exceto se for post de rede social recém-clicado)
    if (!metadata.socialPost) {
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
    if (form.clipContent && !isSocial) {
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
  }, [metadata, form, draftKey, specialType]);

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

  const handleCaptureScreenshot = async () => {
    setCapturingScreenshot(true);
    setError(null);
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        const res = await new Promise<{ success: boolean; dataUrl?: string; error?: string }>((resolve) => {
          chrome.runtime.sendMessage({ action: 'CAPTURE_VISIBLE_TAB' }, (response) => {
            resolve(response || { success: false, error: 'Sem resposta do background script' });
          });
        });

        if (res.success && res.dataUrl) {
          setCoverUrl(res.dataUrl);
        } else {
          setError(res.error || 'Não foi possível capturar a tela.');
        }
      } else {
        setCoverUrl('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200');
      }
    } catch (e: any) {
      setCapturingScreenshot(false);
      setError(e.message || 'Erro ao capturar tela.');
    } finally {
      setCapturingScreenshot(false);
    }
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
          const propNameLower = (mapping.notionPropertyName || '').toLowerCase();

          if (mapping.source === 'page_title' || mapping.notionPropertyType === 'title') {
            val = title;
          } else if (mapping.source === 'page_url' || mapping.notionPropertyType === 'url') {
            val = url;
          } else if (
            mapping.source === 'page_description' ||
            propNameLower === 'description' ||
            propNameLower === 'descrição' ||
            propNameLower === 'descricao' ||
            propNameLower === 'legenda' ||
            propNameLower === 'caption' ||
            propNameLower === 'resumo'
          ) {
            val = description;
          } else if (
            mapping.source === 'page_author' ||
            propNameLower === 'author' ||
            propNameLower === 'autor' ||
            propNameLower === 'username'
          ) {
            val = metadata.socialPost?.username ? `@${metadata.socialPost.username}` : (metadata.author || '');
          } else if (propertyValues[mapping.notionPropertyId] !== undefined) {
            val = propertyValues[mapping.notionPropertyId];
          } else if (
            (propNameLower === 'id' || propNameLower === 'post id' || propNameLower === 'post_id') &&
            metadata.socialPost?.postId
          ) {
            val = metadata.socialPost.postId;
          }

          if (val !== null && val !== undefined && val !== '') {
            propertiesPayload[mapping.notionPropertyName] = {
              type: mapping.notionPropertyType,
              value: val,
            };
          }
        }
      }

      // Verifica se a propriedade 'Description' já está sendo salva na coluna da tabela do Notion
      const hasDescriptionPropertyInDatabase = Object.keys(propertiesPayload).some(
        (key) =>
          key.toLowerCase() === 'description' ||
          key.toLowerCase() === 'descrição' ||
          key.toLowerCase() === 'descricao' ||
          key.toLowerCase() === 'resumo' ||
          key.toLowerCase() === 'legenda'
      );

      // Preparação dos blocos
      const contentBlocks: any[] = [];

      if (isSocialPost && url) {
        // 1. Bloco Embed interativo (Iframe nativo no canvas do Notion - resolve o problema das imagens expirarem!)
        contentBlocks.push({
          object: 'block',
          type: 'embed',
          embed: { url },
        });

        // 2. Legenda / Caption preservada no corpo do Notion (SEMPRE inclui a legenda no canvas em posts de redes sociais!)
        if (description) {
          const chunks = description.match(/[\s\S]{1,1900}/g) || [description];
          for (const chunk of chunks) {
            contentBlocks.push({
              object: 'block',
              type: 'quote',
              quote: {
                rich_text: [{ type: 'text', text: { content: chunk } }],
              },
            });
          }
        }

        // 3. Card informativo com Autor, ID do post e Link direto
        const socialData = metadata.socialPost;
        const authorText = socialData?.username ? `@${socialData.username}` : (metadata.author || '');
        const postIdText = socialData?.postId ? ` • ID: ${socialData.postId}` : '';

        if (authorText || postIdText) {
          contentBlocks.push({
            object: 'block',
            type: 'callout',
            callout: {
              icon: {
                type: 'emoji',
                emoji: (socialData?.platform === 'twitter' || specialType === 'twitter') ? '🐦' : '📸',
              },
              rich_text: [
                {
                  type: 'text',
                  text: { content: `Post de ${authorText}${postIdText}\n` },
                  annotations: { bold: true },
                },
                {
                  type: 'text',
                  text: { content: url, link: { url } },
                },
              ],
            },
          });
        }
      } else if (specialType === 'youtube' && url) {
        contentBlocks.push({
          object: 'block',
          type: 'video',
          video: {
            type: 'external',
            external: { url },
          },
        });
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
      } else if (clipAction === 'selection' && selectedHighlight) {
        if (url) {
          contentBlocks.push({
            object: 'block',
            type: 'bookmark',
            bookmark: { url },
          });
        }
        contentBlocks.push({
          object: 'block',
          type: 'quote',
          quote: {
            rich_text: [
              {
                type: 'text',
                text: { content: selectedHighlight },
                annotations: { italic: true },
              },
            ],
          },
        });
        if (description && description !== selectedHighlight && !hasDescriptionPropertyInDatabase) {
          contentBlocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: description } }],
            },
          });
        }
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

      // Notifica a página para atualizar o status do botão no post
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ action: 'NOTION_SAVE_POST_SAVED', url: result.url }, '*');
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar no Notion.');
    } finally {
      setSaving(false);
    }
  };

  const tagMapping = form.mappings?.find(
    (m) =>
      m.showInPopup &&
      (m.notionPropertyType === 'select' ||
        m.notionPropertyType === 'multi_select' ||
        m.notionPropertyType === 'status')
  );

  const customDatabaseMappings = form.mappings?.filter(
    (m) =>
      m.showInPopup &&
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

      {/* Barra de Navegação do Formulário: [<] [📛 Form Name] [🔗] [⚙️] */}
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
          <span className="text-base">{form.icon || '📛'}</span>
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
            onClick={onEditForm ? () => onEditForm(form) : onOpenSettings}
            title="Configurações do Formulário"
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Banner de Post de Rede Social (Twitter / Instagram) */}
      {isSocialPost && (
        <div className="mx-3.5 mt-2.5 p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-center justify-between gap-2 text-xs text-blue-900 shadow-2xs animate-fadeIn">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-lg shrink-0">
              {metadata.socialPost?.platform === 'instagram' || specialType === 'instagram' ? '📸' : '🐦'}
            </span>
            <div className="min-w-0">
              <div className="font-semibold text-[11px] text-blue-900 truncate">
                {metadata.socialPost?.username
                  ? `@${metadata.socialPost.username}`
                  : (specialType === 'twitter' ? 'Tweet do X' : 'Post do Instagram')}
                {metadata.socialPost?.postId && (
                  <span className="ml-1.5 font-normal text-blue-600/80">#{metadata.socialPost.postId}</span>
                )}
              </div>
              <div className="text-[10px] text-blue-600 truncate">
                Iframe interativo no canvas (mídias não expiram)
              </div>
            </div>
          </div>
          <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full shrink-0">
            Embed
          </span>
        </div>
      )}

      {/* Banner de Alerta: Página Já Salva (Anti-Duplicidade) */}
      {existingPage && (
        <div className="mx-3.5 mt-2.5 p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start justify-between gap-2 text-xs text-amber-900 shadow-2xs animate-fadeIn">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-[11px] text-amber-800">Este link já foi salvo anteriormente!</div>
              <div className="text-[11px] text-amber-700 truncate max-w-[210px] mt-0.5">
                "{existingPage.title}"
              </div>
            </div>
          </div>
          <a
            href={existingPage.url}
            target="_blank"
            rel="noreferrer"
            className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-md font-semibold text-[10px] shrink-0 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span>Ver</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      )}

      {/* Banner de Trecho Destacado (Highlighter) */}
      {selectedHighlight && clipAction === 'selection' && (
        <div className="mx-3.5 mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-xs text-blue-900 shadow-2xs">
          <div className="flex items-center gap-1.5 truncate">
            <Highlighter className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="text-[11px] text-blue-800 font-medium truncate">
              Trecho selecionado capturado
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedHighlight('');
              setClipAction(form.clipContent ? 'content' : 'bookmark');
            }}
            className="text-[10px] text-blue-600 hover:underline cursor-pointer"
          >
            Limpar
          </button>
        </div>
      )}

      {/* Notificação de Sucesso */}
      {savedPageInfo && (
        <div className="m-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-2 text-xs text-emerald-900 shadow-2xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <div className="font-bold text-emerald-800">Página Salva no Notion!</div>
              <div className="text-[11px] text-emerald-700">O conteúdo foi sincronizado com sucesso.</div>
            </div>
          </div>
          <a
            href={savedPageInfo.url}
            target="_blank"
            rel="noreferrer"
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs shrink-0 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span>Abrir</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Notificação de Erro */}
      {error && (
        <div className="m-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-900 shadow-2xs">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-bold text-red-800">Erro ao salvar</div>
            <div className="text-red-700 break-words">{error}</div>
          </div>
        </div>
      )}

      {/* Formulário Principal Estilo Save.to */}
      <form onSubmit={handleSave} className="flex-1 flex flex-col justify-between p-3.5 space-y-3">
        <div className="space-y-3">
          {/* Campo Title (com ícone da página) */}
          <div className="space-y-1">
            <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-600">
              <Type className="w-3.5 h-3.5 text-gray-400" />
              <span>Name</span>
            </label>
            <div className="relative flex items-center">
              {iconUrl ? (
                <img
                  src={iconUrl}
                  alt=""
                  className="w-4 h-4 rounded absolute left-2.5 pointer-events-none object-contain"
                  onError={() => setIconUrl(undefined)}
                />
              ) : (
                <div className="w-4 h-4 rounded bg-gray-200 absolute left-2.5 flex items-center justify-center text-[10px] font-bold text-gray-500 pointer-events-none">
                  N
                </div>
              )}
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título da página..."
                className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
              />
            </div>
          </div>

          {/* Campo URL */}
          <div className="space-y-1">
            <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-600">
              <Link2 className="w-3.5 h-3.5 text-gray-400" />
              <span>URL</span>
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs truncate"
            />
          </div>

          {/* Campo Tags (Select / Multi-Select / Status em destaque) */}
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

          {/* Campo Description */}
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

          {/* Campos Ocultos / Expandíveis (Save.to: "⌅ 4 more fields") */}
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
                    title="Escolher imagem da página"
                  >
                    {coverUrl ? (
                      <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                      <Plus className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={handleCaptureScreenshot}
                      disabled={capturingScreenshot}
                      className="px-2 py-1 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-md text-[10px] font-medium transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                      title="Tirar print da tela visível e usar como cover"
                    >
                      {capturingScreenshot ? (
                        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                      ) : (
                        <Camera className="w-3 h-3 text-gray-500" />
                      )}
                      <span>{capturingScreenshot ? 'Capturando...' : 'Capturar Screenshot'}</span>
                    </button>
                    {coverUrl && (
                      <button
                        type="button"
                        onClick={() => setCoverUrl(undefined)}
                        className="text-[10px] text-gray-400 hover:text-red-500 underline cursor-pointer text-left"
                      >
                        Remover Imagem
                      </button>
                    )}
                  </div>
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
                    <img src={iconUrl} alt="Icon" className="w-6 h-6 object-contain" />
                  ) : (
                    <span className="text-white font-bold text-xs">N</span>
                  )}
                </div>
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
                        <div className="text-[11px]">
                          {isSocialPost ? 'Incorporar Post (Embed/Iframe)' : 'Save Webpage Content'}
                        </div>
                        {articleData && !isSocialPost && (
                          <div className="text-[10px] text-blue-600 font-normal">
                            ~{articleData.readingTimeMinutes} min • {articleData.wordCount} palavras
                          </div>
                        )}
                        {isSocialPost && (
                          <div className="text-[10px] text-blue-600 font-normal">
                            Renderiza iframe interativo no Notion
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
                  <div
                    onClick={handleStartCustomAreaPicker}
                    className={`flex items-center justify-between p-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${
                      clipAction === 'selection' ? 'bg-blue-50/40 text-blue-900 font-semibold' : 'text-gray-700'
                    }`}
                    title="Clique para selecionar visualmente uma área ou elemento na página"
                  >
                    <div className="flex items-center gap-2">
                      <Scissors className={`w-3.5 h-3.5 ${clipAction === 'selection' ? 'text-blue-600' : 'text-gray-400'}`} />
                      <div>
                        <div className="text-[11px]">Save custom area on webpage</div>
                        <div className="text-[10px] text-gray-400 font-normal">
                          {selectedHighlight ? 'Área capturada!' : 'Clique para apontar e clicar na página'}
                        </div>
                      </div>
                    </div>
                    {clipAction === 'selection' ? (
                      <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-gray-300 shrink-0" />
                    )}
                  </div>
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
                className="w-full py-1.5 flex items-center justify-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
              >
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Ocultar campos</span>
              </button>
            </div>
          ) : (
            /* Botão Expandir Campos Extras Estilo Save.to: "⌅ X more fields" */
            <button
              type="button"
              onClick={() => setShowMoreFields(true)}
              className="w-full py-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200/60 transition-colors cursor-pointer"
            >
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              <span>{3 + customDatabaseMappings.length} more fields</span>
            </button>
          )}
        </div>

        {/* Botão de Submissão Estilo Save.to */}
        <div className="pt-2 border-t border-gray-100">
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Salvando no Notion...</span>
              </>
            ) : (
              <span>Salvar no Notion</span>
            )}
          </button>
        </div>
      </form>

      {/* Modal Seletor de Capa */}
      <CoverImagePicker
        isOpen={isCoverPickerOpen}
        currentCover={coverUrl}
        onSelectCover={(newCover) => setCoverUrl(newCover)}
        onClose={() => setIsCoverPickerOpen(false)}
      />
    </div>
  );
};

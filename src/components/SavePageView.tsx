import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  X,
  FileCheck,
  Calendar,
  Tag,
  CheckSquare,
} from 'lucide-react';
import type { FormConfig, ExtractedMetadata } from '../types';
import { createPage } from '../services/notion';

interface SavePageViewProps {
  apiKey: string;
  form: FormConfig;
  metadata: ExtractedMetadata;
  onRefreshMetadata?: () => void;
}

export const SavePageView: React.FC<SavePageViewProps> = ({
  apiKey,
  form,
  metadata,
}) => {
  const [title, setTitle] = useState(metadata.title || '');
  const [url, setUrl] = useState(metadata.url || '');
  const [description, setDescription] = useState(metadata.description || '');
  const [coverUrl, setCoverUrl] = useState<string | undefined>(metadata.coverImage);
  const [propertyValues, setPropertyValues] = useState<Record<string, any>>({});

  const [saving, setSaving] = useState(false);
  const [savedPageInfo, setSavedPageInfo] = useState<{ id: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(metadata.title || '');
    setUrl(metadata.url || '');
    setDescription(metadata.description || '');
    setCoverUrl(metadata.coverImage);
    setSavedPageInfo(null);
    setError(null);
  }, [metadata, form]);

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
          if (!mapping.showInPopup && mapping.source !== 'page_title' && mapping.source !== 'page_url') {
            continue;
          }

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

      // Preparação dos blocos de conteúdo
      const contentBlocks: any[] = [];
      if (form.clipContent) {
        if (description) {
          contentBlocks.push({
            object: 'block',
            type: 'quote',
            quote: {
              rich_text: [{ type: 'text', text: { content: description } }],
            },
          });
        }

        contentBlocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              { type: 'text', text: { content: 'Artigo original salvo de: ' } },
              {
                type: 'text',
                text: { content: url, link: { url: url } },
              },
            ],
          },
        });
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
        coverUrl: coverUrl,
        iconUrl: metadata.favicon,
        contentBlocks: contentBlocks.length > 0 ? contentBlocks : undefined,
      });

      setSavedPageInfo(result);
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar no Notion.');
    } finally {
      setSaving(false);
    }
  };

  const isSavingToPage = form.destinationType === 'page';

  return (
    <div className="p-3.5 space-y-3.5 text-xs text-gray-800">
      {/* Imagem de Capa */}
      {coverUrl ? (
        <div className="relative group rounded-md overflow-hidden h-24 border border-gray-200 bg-gray-100">
          <img
            src={coverUrl}
            alt="Capa"
            className="w-full h-full object-cover"
            onError={() => setCoverUrl(undefined)}
          />
          <button
            type="button"
            onClick={() => setCoverUrl(undefined)}
            title="Remover capa"
            className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black/80 text-white p-1 rounded-full opacity-80 group-hover:opacity-100 transition-opacity cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            const inputUrl = prompt('Insira a URL da imagem de capa:');
            if (inputUrl) setCoverUrl(inputUrl.trim());
          }}
          className="w-full py-1.5 px-2 border border-dashed border-gray-300 hover:border-gray-400 rounded-md text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-[11px]"
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>+ Adicionar Capa</span>
        </button>
      )}

      {/* Formulário de salvamento */}
      <form onSubmit={handleSave} className="space-y-3">
        {/* Título da Página */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
            Título
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-xs font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none"
            placeholder="Título da página"
            required
          />
        </div>

        {/* URL */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
            URL
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full px-2.5 py-1.5 border border-gray-200 bg-gray-50 text-gray-600 rounded-md text-xs truncate focus:ring-1 focus:ring-blue-500 focus:outline-none"
            placeholder="https://..."
          />
        </div>

        {/* Descrição / Resumo */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
            Resumo / Descrição
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none"
            placeholder="Anotações ou resumo da página..."
          />
        </div>

        {/* Outras propriedades customizadas configuradas no Form (quando for Database) */}
        {!isSavingToPage &&
          form.mappings &&
          form.mappings
            .filter(
              (m) =>
                m.showInPopup &&
                m.notionPropertyType !== 'title' &&
                m.notionPropertyType !== 'url' &&
                m.source !== 'page_description'
            )
            .map((m) => (
              <div key={m.notionPropertyId}>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  {m.notionPropertyName}
                </label>
                <input
                  type="text"
                  value={propertyValues[m.notionPropertyId] || ''}
                  onChange={(e) =>
                    setPropertyValues({
                      ...propertyValues,
                      [m.notionPropertyId]: e.target.value,
                    })
                  }
                  placeholder={`Preencher ${m.notionPropertyName}...`}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            ))}

        {/* Mensagem de Erro */}
        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Feedback de Sucesso */}
        {savedPageInfo && (
          <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-xs rounded-md space-y-2">
            <div className="flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span>
                {isSavingToPage && form.pageSaveMode === 'append_block'
                  ? 'Link inserido na página com sucesso!'
                  : 'Salvo com sucesso no Notion!'}
              </span>
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

        {/* Botão de Ação Principal */}
        <button
          type="submit"
          disabled={saving}
          className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs rounded-md shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
        >
          {saving ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Salvando no Notion...</span>
            </>
          ) : (
            <>
              <FileCheck className="w-3.5 h-3.5" />
              <span>
                {isSavingToPage && form.pageSaveMode === 'append_block'
                  ? `Inserir em "${form.databaseTitle}"`
                  : `Salvar em "${form.databaseTitle}"`}
              </span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};

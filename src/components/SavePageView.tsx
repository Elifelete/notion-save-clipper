import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileCheck,
} from 'lucide-react';
import type { FormConfig, ExtractedMetadata } from '../types';
import { createPage } from '../services/notion';
import { CoverImagePicker } from './CoverImagePicker';
import { PropertyField } from './PropertyField';

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

    // Inicializa valores padrão das propriedades configuradas no formulário
    const initialProps: Record<string, any> = {};
    if (form.mappings) {
      for (const m of form.mappings) {
        if (m.defaultValue !== undefined) {
          initialProps[m.notionPropertyId] = m.defaultValue;
        }
      }
    }
    setPropertyValues(initialProps);
  }, [metadata, form]);

  const handlePropertyValueChange = (propertyId: string, val: any) => {
    setPropertyValues((prev) => ({
      ...prev,
      [propertyId]: val,
    }));
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
      {/* Seletor Visual de Capa (com imagens da página e URL) */}
      <CoverImagePicker
        coverUrl={coverUrl}
        onSelectCover={(url) => setCoverUrl(url)}
      />

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

        {/* Renderização Rica de Propriedades da Database (Cores Notion, Tags, Datepicker, Status) */}
        {!isSavingToPage && form.mappings && (
          <div className="space-y-2.5 pt-1 border-t border-gray-100">
            {form.mappings
              .filter(
                (m) =>
                  m.showInPopup &&
                  m.notionPropertyType !== 'title' &&
                  m.notionPropertyType !== 'url' &&
                  m.source !== 'page_description'
              )
              .map((mapping) => (
                <PropertyField
                  key={mapping.notionPropertyId}
                  mapping={mapping}
                  value={propertyValues[mapping.notionPropertyId]}
                  onChange={(val) => handlePropertyValueChange(mapping.notionPropertyId, val)}
                />
              ))}
          </div>
        )}

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

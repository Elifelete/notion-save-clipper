import type { ExtractedMetadata } from '../types';

/**
 * Função injetada na página para coletar metadados do DOM
 */
export function extractPageMetadataScript(): ExtractedMetadata {
  const getMeta = (names: string[]): string => {
    for (const name of names) {
      const el =
        document.querySelector(`meta[property="${name}"]`) ||
        document.querySelector(`meta[name="${name}"]`);
      if (el) {
        const content = el.getAttribute('content');
        if (content && content.trim()) return content.trim();
      }
    }
    return '';
  };

  const getFavicon = (): string => {
    const link =
      (document.querySelector('link[rel*="icon"]') as HTMLLinkElement) ||
      (document.querySelector('link[rel="shortcut icon"]') as HTMLLinkElement) ||
      (document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement);
    if (link && link.href) return link.href;
    return `${window.location.origin}/favicon.ico`;
  };

  const title =
    getMeta(['og:title', 'twitter:title']) ||
    document.title ||
    document.querySelector('h1')?.textContent?.trim() ||
    'Sem título';

  const description =
    getMeta(['og:description', 'twitter:description', 'description']) || '';

  let coverImage = getMeta(['og:image', 'twitter:image', 'image']);
  if (coverImage && coverImage.startsWith('/')) {
    coverImage = new URL(coverImage, window.location.origin).href;
  }

  const author = getMeta(['author', 'article:author', 'twitter:creator']) || '';
  const publishedDate = getMeta(['article:published_time', 'date', 'pubdate']) || '';
  const siteName = getMeta(['og:site_name']) || window.location.hostname;

  return {
    title,
    url: window.location.href,
    description,
    coverImage: coverImage || undefined,
    favicon: getFavicon(),
    author: author || undefined,
    publishedDate: publishedDate || undefined,
    siteName: siteName || undefined,
  };
}

/**
 * Executa a extração na aba ativa do navegador
 */
export async function getActiveTabMetadata(): Promise<ExtractedMetadata> {
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.scripting) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')) {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: extractPageMetadataScript,
        });

        if (results && results[0] && results[0].result) {
          return results[0].result as ExtractedMetadata;
        }
      }

      // Fallback com dados da tab se não puder injetar script
      if (tab) {
        return {
          title: tab.title || 'Sem título',
          url: tab.url || 'https://notion.so',
          description: '',
          favicon: tab.favIconUrl,
        };
      }
    } catch (e) {
      console.warn('Falha ao extrair metadados via scripting API:', e);
    }
  }

  // Fallback para desenvolvimento local
  return {
    title: 'Exemplo: Artigo de Teste para o Notion',
    url: 'https://exemplo.com/como-organizar-seu-segundo-cerebro',
    description: 'Um guia completo e detalhado sobre como criar fluxos de captura rápidos e inteligentes no Notion.',
    coverImage: 'https://images.unsplash.com/photo-1517842645767-c639042777db?w=1200',
    favicon: 'https://notion.so/favicon.ico',
    author: 'Equipe de Produtividade',
    publishedDate: new Date().toISOString().split('T')[0],
    siteName: 'exemplo.com',
  };
}

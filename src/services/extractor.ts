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
 * Função injetada na página para coletar todas as imagens significativas da página
 */
export function extractPageImagesScript(): string[] {
  const urls = new Set<string>();

  // 1. Meta tags de imagem (OG, Twitter)
  const metaImages = [
    document.querySelector('meta[property="og:image"]')?.getAttribute('content'),
    document.querySelector('meta[name="twitter:image"]')?.getAttribute('content'),
  ];
  for (const img of metaImages) {
    if (img && img.startsWith('http')) {
      urls.add(img);
    }
  }

  // 2. Tags <img> presentes no documento
  const imgElements = Array.from(document.querySelectorAll('img'));
  for (const img of imgElements) {
    const src = img.currentSrc || img.src || img.getAttribute('data-src');
    if (!src) continue;

    // Filtra URLs inválidas
    if (!src.startsWith('http')) continue;

    // Filtra ícones minúsculos e rastreadores (ex: pixels de 1x1)
    const width = img.naturalWidth || img.clientWidth || img.width;
    const height = img.naturalHeight || img.clientHeight || img.height;
    if (width > 0 && width < 80) continue;
    if (height > 0 && height < 80) continue;

    urls.add(src);
    if (urls.size >= 30) break; // Limita a 30 imagens para não sobrecarregar
  }

  return Array.from(urls);
}

/**
 * Executa a extração de imagens na aba ativa do navegador
 */
export async function getActiveTabImages(): Promise<string[]> {
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.scripting) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')) {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: extractPageImagesScript,
        });

        if (results && results[0] && Array.isArray(results[0].result)) {
          return results[0].result as string[];
        }
      }
    } catch (e) {
      console.warn('Falha ao extrair imagens via scripting API:', e);
    }
  }

  // Fallbacks de exemplo para teste local
  return [
    'https://images.unsplash.com/photo-1517842645767-c639042777db?w=1200',
    'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200',
    'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=1200',
  ];
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

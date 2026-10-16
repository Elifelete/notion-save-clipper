import { Readability } from '@mozilla/readability';
import { htmlToNotionBlocks } from './notionBlocks';

export interface ArticleParsedContent {
  title: string;
  byline?: string;
  excerpt?: string;
  textContent: string;
  htmlContent: string;
  readingTimeMinutes: number;
  wordCount: number;
  blocks: any[];
  isSpecialPage?: 'youtube' | 'github' | 'twitter' | null;
}

/**
 * Detecta se a URL pertence a serviços especiais com tratamento dedicado
 */
export function detectSpecialPage(url: string): 'youtube' | 'github' | 'twitter' | null {
  if (!url) return null;
  const lower = url.toLowerCase();
  if (lower.includes('youtube.com/watch') || lower.includes('youtu.be/')) {
    return 'youtube';
  }
  if (lower.includes('github.com/') && !lower.endsWith('github.com/')) {
    return 'github';
  }
  if (lower.includes('twitter.com/') || lower.includes('x.com/')) {
    return 'twitter';
  }
  return null;
}

/**
 * Executado diretamente na página web (DOM ativo) para extrair o artigo limpo
 */
export function extractArticleFromDom(): {
  title: string;
  byline: string;
  excerpt: string;
  htmlContent: string;
  textContent: string;
  wordCount: number;
  readingTimeMinutes: number;
} {
  const url = window.location.href;
  const special = detectSpecialPage(url);

  // 1. Tratamento para YouTube
  if (special === 'youtube') {
    const videoTitle =
      document.querySelector('h1.ytd-video-primary-info-renderer yt-formatted-string')?.textContent ||
      document.querySelector('h1.title yt-formatted-string')?.textContent ||
      document.title.replace(' - YouTube', '');
    const channelName =
      document.querySelector('#channel-name #text a')?.textContent ||
      document.querySelector('ytd-channel-name yt-formatted-string')?.textContent ||
      '';
    const description =
      document.querySelector('#description-inline-expander')?.textContent?.trim() ||
      document.querySelector('meta[name="description"]')?.getAttribute('content') ||
      '';

    return {
      title: videoTitle.trim(),
      byline: channelName.trim(),
      excerpt: description.slice(0, 300),
      htmlContent: `<p><strong>Canal:</strong> ${channelName}</p><blockquote>${description.slice(0, 1000)}</blockquote>`,
      textContent: description,
      wordCount: description.split(/\s+/).length,
      readingTimeMinutes: 1,
    };
  }

  // 2. Tratamento para GitHub
  if (special === 'github') {
    const repoTitle =
      document.querySelector('#repository-container-header')?.textContent?.replace(/\s+/g, ' ').trim() ||
      document.title.replace(' · GitHub', '');
    const repoDesc =
      document.querySelector('p.f4.my-3')?.textContent?.trim() ||
      document.querySelector('meta[name="description"]')?.getAttribute('content') ||
      '';
    const readmeContent = document.querySelector('article.markdown-body')?.innerHTML || '';

    return {
      title: repoTitle,
      byline: 'GitHub Repository',
      excerpt: repoDesc,
      htmlContent: `<p><em>${repoDesc}</em></p>${readmeContent}`,
      textContent: repoDesc,
      wordCount: readmeContent.split(/\s+/).length,
      readingTimeMinutes: Math.max(1, Math.ceil(readmeContent.split(/\s+/).length / 200)),
    };
  }

  // 3. Artigo Padrão com Readability
  try {
    const docClone = document.cloneNode(true) as Document;
    const reader = new Readability(docClone);
    const parsed = reader.parse();

    if (parsed) {
      const textContent = parsed.textContent || '';
      const words = textContent.trim().split(/\s+/).filter(Boolean).length;
      const readingTime = Math.max(1, Math.ceil(words / 200));

      return {
        title: parsed.title || document.title,
        byline: parsed.byline || '',
        excerpt: parsed.excerpt || '',
        htmlContent: parsed.content || '',
        textContent: textContent,
        wordCount: words,
        readingTimeMinutes: readingTime,
      };
    }
  } catch (e) {
    console.warn('Readability falhou no DOM, usando extração simples:', e);
  }

  // Fallback caso não seja possível extrair corpo de artigo
  const fallbackText = document.querySelector('article')?.textContent || document.body.innerText || '';
  const words = fallbackText.split(/\s+/).slice(0, 500).join(' ');

  return {
    title: document.title,
    byline: '',
    excerpt: '',
    htmlContent: `<p>${words.slice(0, 2000)}</p>`,
    textContent: words,
    wordCount: words.split(/\s+/).length,
    readingTimeMinutes: 1,
  };
}

/**
 * Extrai o artigo da aba ativa e converte para blocos do Notion prontos para salvar
 */
export async function getActiveTabArticle(): Promise<ArticleParsedContent | null> {
  let extracted: any = null;

  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.scripting) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')) {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: extractArticleFromDom,
        });

        if (results && results[0] && results[0].result) {
          extracted = results[0].result;
        }
      }
    } catch (e) {
      console.warn('Falha ao rodar Readability na aba ativa:', e);
    }
  }

  if (!extracted) {
    // Fallback de desenvolvimento local
    return null;
  }

  const special = detectSpecialPage(extracted.title || '');
  const blocks: any[] = [];

  // Cabeçalho de metadados do artigo
  if (extracted.byline) {
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          { type: 'text', text: { content: '✍️ Autor / Fonte: ' } },
          { type: 'text', text: { content: extracted.byline }, annotations: { bold: true } },
        ],
      },
    });
  }

  // Citação de resumo (excerpt)
  if (extracted.excerpt) {
    blocks.push({
      object: 'block',
      type: 'quote',
      quote: {
        rich_text: [{ type: 'text', text: { content: extracted.excerpt } }],
      },
    });
  }

  // Divisor visual
  blocks.push({
    object: 'block',
    type: 'divider',
    divider: {},
  });

  // Converte o corpo HTML em blocos do Notion
  const bodyBlocks = htmlToNotionBlocks(extracted.htmlContent);
  blocks.push(...bodyBlocks);

  return {
    title: extracted.title,
    byline: extracted.byline,
    excerpt: extracted.excerpt,
    textContent: extracted.textContent,
    htmlContent: extracted.htmlContent,
    readingTimeMinutes: extracted.readingTimeMinutes,
    wordCount: extracted.wordCount,
    blocks,
    isSpecialPage: special,
  };
}

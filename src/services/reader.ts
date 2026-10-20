import { Readability } from '@mozilla/readability';
import { htmlToNotionBlocks } from './notionBlocks';

export interface ArticleParsedContent {
  title: string;
  byline: string;
  excerpt: string;
  htmlContent: string;
  textContent: string;
  wordCount: number;
  readingTimeMinutes: number;
  blocks: any[]; // Structured Notion API v1 blocks
}

/**
 * Detects if the URL belongs to special services with dedicated handling
 */
export function detectSpecialPage(url: string): 'youtube' | 'github' | 'twitter' | 'instagram' | null {
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
  if (lower.includes('instagram.com/')) {
    return 'instagram';
  }
  return null;
}

/**
 * Runs directly in the active web page DOM to extract clean article content
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

  // 1. YouTube handling
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
      htmlContent: `<p><strong>Channel:</strong> ${channelName}</p><blockquote>${description.slice(0, 1000)}</blockquote>`,
      textContent: description,
      wordCount: description.split(/\s+/).length,
      readingTimeMinutes: 1,
    };
  }

  // 2. GitHub handling
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

  // 3. Twitter / X handling
  if (special === 'twitter') {
    const tweetEl = document.querySelector('article[data-testid="tweet"]');
    const textEl = tweetEl?.querySelector('[data-testid="tweetText"]');
    const tweetText = textEl ? (textEl as HTMLElement).innerText.trim() : '';
    const authorEl = tweetEl?.querySelector('[data-testid="User-Name"]');
    const authorName = authorEl?.textContent?.replace(/\s+/g, ' ').trim() || '';

    return {
      title: document.title,
      byline: authorName,
      excerpt: tweetText.slice(0, 300),
      htmlContent: `<p><strong>Post:</strong> ${tweetText}</p>`,
      textContent: tweetText,
      wordCount: tweetText.split(/\s+/).length,
      readingTimeMinutes: 1,
    };
  }

  // 4. Instagram handling
  if (special === 'instagram') {
    const postEl = document.querySelector('article') || document.body;
    const h1Caption = postEl.querySelector('h1')?.textContent?.trim() || '';
    const authorName = postEl.querySelector('header a[role="link"]')?.textContent?.trim() || '';

    return {
      title: document.title,
      byline: authorName ? `@${authorName}` : '',
      excerpt: h1Caption.slice(0, 300),
      htmlContent: `<p>${h1Caption}</p>`,
      textContent: h1Caption,
      wordCount: h1Caption.split(/\s+/).length,
      readingTimeMinutes: 1,
    };
  }

  // 5. Standard Readability parsing
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
    console.warn('Readability failed in DOM, falling back to simple extraction:', e);
  }

  // Fallback if unable to parse article body
  const fallbackText = document.querySelector('article')?.textContent || document.body.innerText || '';
  const words = fallbackText.split(/\s+/).slice(0, 500).join(' ');

  return {
    title: document.title,
    byline: '',
    excerpt: '',
    htmlContent: `<p>${words.slice(0, 2000)}</p>`,
    textContent: fallbackText.slice(0, 2000),
    wordCount: words.length,
    readingTimeMinutes: 1,
  };
}

/**
 * Extracts active tab article and converts HTML directly into structured Notion API blocks
 */
export async function getActiveTabArticle(): Promise<ArticleParsedContent | null> {
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.scripting) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')) {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: extractArticleFromDom,
        });

        if (results && results[0] && results[0].result) {
          const extracted = results[0].result as any;
          const blocks = htmlToNotionBlocks(extracted.htmlContent);

          return {
            ...extracted,
            blocks,
          };
        }
      }
    } catch (e) {
      console.warn('Failed to extract article via Readability on active tab:', e);
    }
  }

  // Fallback mock for local development
  return {
    title: 'Building a Second Brain: The Art of Capturing Ideas',
    byline: 'Tiago Forte',
    excerpt: 'Discover how to organize your digital life and boost your productivity using Notion.',
    htmlContent:
      '<h2>Why capture?</h2><p>We live in a sea of information. Saving rich content to Notion allows you to turn passive consumption into creative action.</p><blockquote>"Your mind is for having ideas, not holding them."</blockquote>',
    textContent: 'Why capture? We live in a sea of information...',
    wordCount: 35,
    readingTimeMinutes: 1,
    blocks: htmlToNotionBlocks(
      '<h2>Why capture?</h2><p>We live in a sea of information. Saving rich content to Notion allows you to turn passive consumption into creative action.</p><blockquote>"Your mind is for having ideas, not holding them."</blockquote>'
    ),
  };
}

import type { ExtractedMetadata, SocialPostData } from '../types';
import { extractTwitterTweet, extractInstagramPost } from './socialMedia';

/**
 * Script injected into the page to collect DOM metadata
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
    'Untitled';

  const description =
    getMeta(['og:description', 'twitter:description', 'description']) || '';

  let coverImage = getMeta(['og:image', 'twitter:image', 'image']);
  if (coverImage && coverImage.startsWith('/')) {
    coverImage = new URL(coverImage, window.location.origin).href;
  }

  const author = getMeta(['author', 'article:author', 'twitter:creator']) || '';
  const publishedDate = getMeta(['article:published_time', 'date', 'pubdate']) || '';
  const siteName = getMeta(['og:site_name']) || window.location.hostname;

  const selection = window.getSelection() ? window.getSelection()!.toString().trim() : '';

  // Special detection for Twitter/X and Instagram
  let socialPost: SocialPostData | undefined;
  const host = window.location.hostname.toLowerCase();
  if (host.includes('twitter.com') || host.includes('x.com')) {
    const tweetEl = document.querySelector<HTMLElement>('article[data-testid="tweet"]');
    if (tweetEl) {
      socialPost = extractTwitterTweet(tweetEl) || undefined;
    }
  } else if (host.includes('instagram.com')) {
    const postEl = document.querySelector<HTMLElement>('article') || document.body;
    socialPost = extractInstagramPost(postEl) || undefined;
  }

  let finalTitle = title;
  let finalDescription = description;
  let finalAuthor = author;

  if (socialPost) {
    finalTitle =
      socialPost.platform === 'twitter'
        ? `@${socialPost.username}'s Post on X`
        : `@${socialPost.username}'s Post on Instagram`;
    if (socialPost.caption) {
      finalDescription = socialPost.caption;
    }
    finalAuthor = `@${socialPost.username}`;
  }

  return {
    title: finalTitle,
    url: socialPost?.postUrl || window.location.href,
    description: finalDescription,
    coverImage: coverImage || undefined,
    favicon: getFavicon(),
    author: finalAuthor || undefined,
    publishedDate: publishedDate || undefined,
    siteName: siteName || undefined,
    selectedText: selection || undefined,
    socialPost,
  };
}

/**
 * Script injected into the page to collect all meaningful images
 */
export function extractPageImagesScript(): string[] {
  const urls = new Set<string>();

  // 1. Meta image tags (OG, Twitter)
  const metaImages = [
    document.querySelector('meta[property="og:image"]')?.getAttribute('content'),
    document.querySelector('meta[name="twitter:image"]')?.getAttribute('content'),
  ];
  for (const img of metaImages) {
    if (img && img.startsWith('http')) {
      urls.add(img);
    }
  }

  // 2. <img> tags present in document
  const imgElements = Array.from(document.querySelectorAll('img'));
  for (const img of imgElements) {
    const src = img.currentSrc || img.src || img.getAttribute('data-src');
    if (!src) continue;

    if (!src.startsWith('http')) continue;

    // Filter tiny icons and trackers
    const width = img.naturalWidth || img.clientWidth || img.width;
    const height = img.naturalHeight || img.clientHeight || img.height;
    if (width > 0 && width < 80) continue;
    if (height > 0 && height < 80) continue;

    urls.add(src);
    if (urls.size >= 30) break;
  }

  return Array.from(urls);
}

/**
 * Extracts images from active browser tab
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
      console.warn('Failed to extract images via scripting API:', e);
    }
  }

  // Fallback examples for local testing
  return [
    'https://images.unsplash.com/photo-1517842645767-c639042777db?w=1200',
    'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200',
    'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=1200',
  ];
}

/**
 * Extracts metadata from active browser tab
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

      if (tab) {
        return {
          title: tab.title || 'Untitled',
          url: tab.url || 'https://notion.so',
          description: '',
          favicon: tab.favIconUrl,
        };
      }
    } catch (e) {
      console.warn('Failed to extract metadata via scripting API:', e);
    }
  }

  // Fallback for local development
  return {
    title: 'Example: Test Article for Notion',
    url: 'https://example.com/how-to-build-a-second-brain',
    description: 'A comprehensive guide on creating fast and intelligent capture workflows for Notion.',
    coverImage: 'https://images.unsplash.com/photo-1517842645767-c639042777db?w=1200',
    favicon: 'https://notion.so/favicon.ico',
    author: 'Productivity Team',
  };
}

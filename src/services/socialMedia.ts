import type { SocialPostData } from '../types';
export type { SocialPostData };

/**
 * Determines whether the current page belongs to Twitter/X or Instagram
 */
export function getSocialPlatform(): 'twitter' | 'instagram' | null {
  if (typeof window === 'undefined' || !window.location || !window.location.hostname) return null;
  const host = window.location.hostname.toLowerCase();
  if (host.includes('twitter.com') || host.includes('x.com')) return 'twitter';
  if (host.includes('instagram.com')) return 'instagram';
  return null;
}

/**
 * Extracts structured data from a Tweet given its article[data-testid="tweet"] element
 */
export function extractTwitterTweet(tweetEl: HTMLElement): SocialPostData | null {
  try {
    const permalinkEl = tweetEl.querySelector('time')?.closest('a');
    const postUrl = permalinkEl
      ? (permalinkEl as HTMLAnchorElement).href
      : typeof window !== 'undefined' && window.location
      ? window.location.href
      : '';

    const userEl = tweetEl.querySelector('[data-testid="User-Name"]');
    let username = '';
    if (userEl) {
      const match = userEl.textContent?.match(/@(\w+)/);
      if (match && match[1]) {
        username = match[1];
      }
    }

    const textEl = tweetEl.querySelector('[data-testid="tweetText"]');
    const caption = textEl ? (textEl as HTMLElement).innerText.trim() : '';

    const urlMatch = postUrl.match(/status\/(\d+)/);
    const postId = urlMatch && urlMatch[1] ? urlMatch[1] : Date.now().toString();

    return {
      platform: 'twitter',
      username: username || 'twitter_user',
      postId,
      postUrl,
      caption,
    };
  } catch (err) {
    console.warn('Error extracting tweet:', err);
    return null;
  }
}

/**
 * Extracts structured data from an Instagram post given its container element
 */
export function extractInstagramPost(postEl: HTMLElement): SocialPostData | null {
  try {
    const postUrl = typeof window !== 'undefined' && window.location ? window.location.href : '';
    const urlMatch = postUrl.match(/\/p\/([^\/]+)/) || postUrl.match(/\/reel\/([^\/]+)/);
    const postId = urlMatch && urlMatch[1] ? urlMatch[1] : Date.now().toString();

    const authorEl =
      postEl.querySelector('header a[role="link"]') ||
      (typeof document !== 'undefined' ? document.querySelector('header a[role="link"]') : null);
    const username = authorEl?.textContent?.trim() || 'instagram_user';

    const captionEl =
      postEl.querySelector('h1') ||
      postEl.querySelector('div[role="button"] + span') ||
      postEl.querySelector('span > div > span');
    const caption = captionEl ? (captionEl as HTMLElement).innerText.trim() : '';

    return {
      platform: 'instagram',
      username,
      postId,
      postUrl,
      caption,
    };
  } catch (err) {
    console.warn('Error extracting Instagram post:', err);
    return null;
  }
}

/**
 * Visual badge button styles for Twitter/X and Instagram
 */
const BADGE_CLASS = 'notion-save-social-badge';

function createSaveButton(onClick: () => void, isSmall = false): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = BADGE_CLASS;
  btn.title = 'Save to Notion';

  btn.style.cssText = `
    display: inline-flex !important;
    align-items: center !important;
    gap: 5px !important;
    background: #000000 !important;
    color: #ffffff !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    border-radius: 9999px !important;
    padding: ${isSmall ? '2px 8px' : '4px 10px'} !important;
    font-size: ${isSmall ? '11px' : '12px'} !important;
    font-weight: 600 !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    cursor: pointer !important;
    z-index: 9999 !important;
    transition: all 0.15s ease !important;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2) !important;
    line-height: 1 !important;
    user-select: none !important;
  `;

  btn.innerHTML = `
    <span style="font-weight: 800; font-size: 11px; background: #ffffff; color: #000000; width: 14px; height: 14px; border-radius: 3px; display: inline-flex; align-items: center; justify-content: center;">N</span>
    <span>Save</span>
  `;

  btn.addEventListener('mouseenter', () => {
    btn.style.background = '#2563eb';
    btn.style.borderColor = '#3b82f6';
  });

  btn.addEventListener('mouseleave', () => {
    if (!btn.getAttribute('data-saved')) {
      btn.style.background = '#000000';
      btn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    }
  });

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });

  return btn;
}

/**
 * Changes badge state to "Saved!" with checkmark
 */
export function markBadgeSaved(btn: HTMLElement) {
  btn.setAttribute('data-saved', 'true');
  btn.style.background = '#10b981';
  btn.style.borderColor = '#059669';
  btn.innerHTML = `
    <span style="font-weight: 800; font-size: 11px; color: #ffffff;">✓</span>
    <span>Saved!</span>
  `;
}

/**
 * Observes DOM mutations and injects buttons into tweets on Twitter/X
 */
export function injectTwitterBadges(onSaveTweet: (data: SocialPostData, btn: HTMLElement) => void): () => void {
  if (typeof document === 'undefined') return () => {};

  const processTweets = () => {
    const tweets = document.querySelectorAll<HTMLElement>('article[data-testid="tweet"]');
    tweets.forEach((tweet) => {
      if (tweet.querySelector(`.${BADGE_CLASS}`)) return;

      const actionsGroup = tweet.querySelector('div[role="group"]');
      if (actionsGroup) {
        const btn = createSaveButton(() => {
          const data = extractTwitterTweet(tweet);
          if (data) {
            onSaveTweet(data, btn);
          }
        }, true);

        const container = document.createElement('div');
        container.style.cssText = 'display: inline-flex; align-items: center; margin-left: 8px;';
        container.appendChild(btn);

        actionsGroup.appendChild(container);
      }
    });
  };

  processTweets();

  const observer = new MutationObserver(() => {
    processTweets();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return () => observer.disconnect();
}

/**
 * Observes DOM mutations and injects button into Instagram post action bar
 */
export function injectInstagramBadges(onSavePost: (data: SocialPostData, btn: HTMLElement) => void): () => void {
  if (typeof document === 'undefined') return () => {};

  const processInstagram = () => {
    const sections = document.querySelectorAll<HTMLElement>('section');
    sections.forEach((section) => {
      if (section.querySelector(`.${BADGE_CLASS}`)) return;

      const bookmarkSvg = section.querySelector('svg[aria-label*="Salvar"], svg[aria-label*="Save"]');
      if (bookmarkSvg) {
        const actionRow = bookmarkSvg.closest('div');
        if (actionRow && actionRow.parentElement) {
          const article = section.closest('article') || document.body;
          const btn = createSaveButton(() => {
            const data = extractInstagramPost(article as HTMLElement);
            if (data) {
              onSavePost(data, btn);
            }
          }, true);

          const container = document.createElement('div');
          container.style.cssText = 'display: inline-flex; align-items: center; margin-right: 8px;';
          container.appendChild(btn);

          actionRow.parentElement.insertBefore(container, actionRow);
        }
      }
    });
  };

  processInstagram();

  const observer = new MutationObserver(() => {
    processInstagram();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return () => observer.disconnect();
}

/**
 * Automatically initializes injection based on current social media platform
 */
export function initSocialMediaBadges(onSave: (data: SocialPostData, btn: HTMLElement) => void): (() => void) | null {
  const platform = getSocialPlatform();
  if (platform === 'twitter') {
    return injectTwitterBadges(onSave);
  }
  if (platform === 'instagram') {
    return injectInstagramBadges(onSave);
  }
  return null;
}

import type { SocialPostData } from '../types';

/**
 * Identifica se a página atual pertence ao Twitter/X ou Instagram
 */
export function getSocialPlatform(): 'twitter' | 'instagram' | null {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname.toLowerCase();
  if (host.includes('twitter.com') || host.includes('x.com')) return 'twitter';
  if (host.includes('instagram.com')) return 'instagram';
  return null;
}

/**
 * Extrai dados estruturados de um Tweet a partir do seu elemento article[data-testid="tweet"]
 */
export function extractTwitterTweet(article: HTMLElement): SocialPostData | null {
  try {
    const root = article.closest('article[data-testid="tweet"]') || article;

    // 1. Username / Handle
    let username = '';
    const userBlock = root.querySelector('[data-testid="User-Name"]');
    if (userBlock) {
      const handleEl = Array.from(userBlock.querySelectorAll('span, a')).find((el) => {
        const text = el.textContent?.trim() || '';
        return text.startsWith('@') && text.length > 1;
      });

      if (handleEl && handleEl.textContent) {
        username = handleEl.textContent.trim().replace('@', '');
      } else {
        const userLink = userBlock.querySelector('a[role="link"][href^="/"]');
        const href = userLink?.getAttribute('href') || '';
        if (href && !href.includes('/status/')) {
          username = href.replace('/', '').split('/')[0] || '';
        }
      }
    }

    // 2. Post URL e Post ID
    let postUrl = '';
    let postId = '';

    const timeLink = root.querySelector('a[href*="/status/"]');
    if (timeLink) {
      const href = timeLink.getAttribute('href') || '';
      if (href) {
        postUrl = href.startsWith('http') ? href : `https://x.com${href}`;
        const match = href.match(/\/status\/(\d+)/);
        if (match && match[1]) {
          postId = match[1];
        }
      }
    }

    if (!postUrl && window.location.href.includes('/status/')) {
      const match = window.location.href.match(/\/status\/(\d+)/);
      if (match && match[1]) {
        postId = match[1];
        postUrl = window.location.href.split('?')[0] || window.location.href;
      }
    }

    // 3. Legenda / Texto do Tweet (expande "Show more" se houver)
    const showMoreBtn = root.querySelector<HTMLElement>('[data-testid="tweet-text-show-more-link"]');
    if (showMoreBtn) {
      try {
        showMoreBtn.click();
      } catch {
        // Ignore
      }
    }

    const tweetTextEl = root.querySelector('[data-testid="tweetText"]');
    const caption = tweetTextEl ? (tweetTextEl as HTMLElement).innerText.trim() : '';

    if (!postId && !postUrl) {
      return null;
    }

    return {
      platform: 'twitter',
      username: username || 'twitter_user',
      postId: postId || 'tweet',
      postUrl: postUrl || window.location.href,
      caption,
    };
  } catch (err) {
    console.warn('[Notion Save] Erro ao extrair dados do Tweet:', err);
    return null;
  }
}

/**
 * Extrai dados estruturados de um post do Instagram com captura robusta da legenda em feeds e modais
 */
export function extractInstagramPost(targetEl: HTMLElement): SocialPostData | null {
  try {
    // 1. Encontra a raiz completa do post: modal <div role="dialog">, <article> do post, ou o documento
    const root =
      targetEl.closest('div[role="dialog"]') ||
      targetEl.closest('article') ||
      document.querySelector('div[role="dialog"]') ||
      document.querySelector('article') ||
      document.body;

    // 2. Post ID e URL (/p/CODE/ ou /reel/CODE/)
    let postUrl = '';
    let postId = '';

    const postLink = root.querySelector('a[href*="/p/"], a[href*="/reel/"]');
    if (postLink) {
      const href = postLink.getAttribute('href') || '';
      const match = href.match(/\/(p|reel)\/([A-Za-z0-9_-]+)/);
      if (match && match[2]) {
        postId = match[2];
        postUrl = `https://www.instagram.com/p/${postId}/`;
      }
    }

    // Se estiver na URL direta do post ou em modal de post
    if (!postId) {
      const match = window.location.pathname.match(/\/(p|reel)\/([A-Za-z0-9_-]+)/);
      if (match && match[2]) {
        postId = match[2];
        postUrl = `https://www.instagram.com/p/${postId}/`;
      }
    }

    // 3. Username do autor
    let username = '';
    const header = root.querySelector('header');
    if (header) {
      const userLink = header.querySelector('a[role="link"]');
      if (userLink && userLink.textContent?.trim()) {
        username = userLink.textContent.trim().replace('@', '');
      }
    }

    if (!username) {
      const userLinks = root.querySelectorAll('a[role="link"][href^="/"]');
      for (const link of Array.from(userLinks)) {
        const href = link.getAttribute('href') || '';
        if (
          href &&
          !href.includes('/p/') &&
          !href.includes('/reel/') &&
          !href.includes('/explore/') &&
          !href.includes('/direct/') &&
          !href.includes('/stories/')
        ) {
          username = href.replace(/\//g, '').split('?')[0] || '';
          if (username) break;
        }
      }
    }

    // 4. Se houver botão de expandir "... mais" / "... more", clica para revelar o texto integral
    try {
      const allButtons = root.querySelectorAll<HTMLElement>('button, span[role="button"], div[role="button"]');
      for (const btn of Array.from(allButtons)) {
        const txt = (btn.textContent || '').trim().toLowerCase();
        if (
          txt === 'mais' ||
          txt === 'more' ||
          txt === '... mais' ||
          txt === '… mais' ||
          txt.endsWith('mais') ||
          txt.endsWith('more')
        ) {
          btn.click();
          break;
        }
      }
    } catch {
      // Ignore
    }

    // 5. Extração da Legenda / Caption
    let caption = '';

    // ESTRATÉGIA 1: Tag <h1> usada especificamente pelo Instagram para a legenda do post em modal e página de post
    const h1El = root.querySelector<HTMLElement>('h1');
    if (h1El) {
      const h1Text = (h1El.innerText || h1El.textContent || '').trim();
      if (h1Text && h1Text.length > 5 && !h1Text.toLowerCase().includes('curtidas')) {
        caption = h1Text;
      }
    }

    // ESTRATÉGIA 2: Primeiro item da lista de comentários no painel lateral direito (ul > li ou div[role="listitem"])
    if (!caption) {
      const firstComment = root.querySelector('ul > div > li, ul > li, div[role="listitem"]');
      if (firstComment) {
        const captionEl = firstComment.querySelector('h1, span._a9zs, span._ap3a, span[dir="auto"]');
        if (captionEl) {
          const text = ((captionEl as HTMLElement).innerText || captionEl.textContent || '').trim();
          if (text && text.length > 5) {
            caption = text;
          }
        } else {
          const fullText = ((firstComment as HTMLElement).innerText || firstComment.textContent || '').trim();
          if (fullText && fullText.length > 10) {
            caption = fullText;
          }
        }
      }
    }

    // ESTRATÉGIA 3: Classes CSS conhecidas do Instagram para o corpo da legenda (_a9zs, _ap3a, x193iq5w)
    if (!caption) {
      const candidates: string[] = [];
      const textEls = root.querySelectorAll<HTMLElement>(
        'div._a9zs, span._a9zs, span._ap3a, span.x193iq5w[dir="auto"], span[dir="auto"]'
      );

      for (const el of Array.from(textEls)) {
        if (el.closest('header') || el.closest('section') || el.closest('.notion-save-social-badge-container')) {
          continue;
        }

        const rawText = (el.innerText || el.textContent || '').trim();
        if (rawText && rawText.length > 15) {
          candidates.push(rawText);
        }
      }

      if (candidates.length > 0) {
        candidates.sort((a, b) => b.length - a.length);
        caption = candidates[0] || '';
      }
    }

    // ESTRATÉGIA 4: Procura no bloco de texto após o <section> de ações
    if (!caption) {
      const actionSection = root.querySelector('section');
      if (actionSection && actionSection.parentElement) {
        const afterSectionElements = actionSection.parentElement.querySelectorAll('div, span');
        for (const el of Array.from(afterSectionElements)) {
          if (el.closest('section') || el.closest('header')) continue;
          const text = ((el as HTMLElement).innerText || el.textContent || '').trim();
          if (text.length > 25 && !text.includes('curtidas') && !text.includes('likes')) {
            if (text.length > caption.length) {
              caption = text;
            }
          }
        }
      }
    }

    // ESTRATÉGIA 5: Fallback para meta tags na página
    if (!caption) {
      const ogDesc =
        document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
        document.querySelector('meta[name="description"]')?.getAttribute('content') ||
        document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
        '';
      const quoteMatch = ogDesc.match(/:\s*[“"«](.+)[”"»]/s) || ogDesc.match(/no Instagram:\s*(.+)$/s);
      if (quoteMatch && quoteMatch[1]) {
        caption = quoteMatch[1].trim();
      } else if (ogDesc && !ogDesc.includes('curtidas,')) {
        caption = ogDesc.trim();
      }
    }

    // Limpezas finais na legenda:
    if (caption && username) {
      const userPrefixRegex = new RegExp(`^@?${username}\\s*`, 'i');
      caption = caption.replace(userPrefixRegex, '').trim();
    }

    // Remove tempo decorrido colado (ex: "• 1 sem" ou "1 sem")
    caption = caption.replace(/^•?\s*\d+\s*(sem|h|d|min|s|w|m)\s*/i, '').trim();

    // Remove sufixo "... mais" / "… more"
    caption = caption.replace(/\s*[.…\s]*(mais|more)\s*$/i, '').trim();

    if (!postId && !postUrl) {
      return null;
    }

    return {
      platform: 'instagram',
      username: username || 'instagram_user',
      postId: postId || 'post',
      postUrl: postUrl || window.location.href,
      caption,
    };
  } catch (err) {
    console.warn('[Notion Save] Erro ao extrair dados do post do Instagram:', err);
    return null;
  }
}

/**
 * Cria o elemento visual do badge/botão "Salvar no Notion"
 */
export function createSocialBadgeElement(
  platform: 'twitter' | 'instagram',
  onClick: (buttonEl: HTMLElement) => void
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'notion-save-social-badge-container';

  if (platform === 'twitter') {
    container.style.cssText = `
      display: inline-flex !important;
      align-items: center !important;
      cursor: pointer !important;
      user-select: none !important;
      margin-left: 2px !important;
    `;

    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', 'Salvar no Notion');
    button.title = 'Salvar tweet no Notion';
    button.style.cssText = `
      display: inline-flex !important;
      align-items: center !important;
      gap: 5px !important;
      background: rgba(37, 99, 235, 0.08) !important;
      color: #2563eb !important;
      border: 1px solid rgba(37, 99, 235, 0.22) !important;
      border-radius: 9999px !important;
      padding: 3px 10px !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      cursor: pointer !important;
      transition: all 0.15s ease !important;
      line-height: 1.4 !important;
    `;

    button.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
      </svg>
      <span>Salvar</span>
    `;

    button.addEventListener('mouseenter', () => {
      button.style.background = '#2563eb';
      button.style.color = '#ffffff';
      button.style.transform = 'scale(1.04)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = 'rgba(37, 99, 235, 0.08)';
      button.style.color = '#2563eb';
      button.style.transform = 'scale(1)';
    });

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick(button);
    });

    container.appendChild(button);
  } else {
    container.style.cssText = `
      display: inline-flex !important;
      align-items: center !important;
      cursor: pointer !important;
      user-select: none !important;
      z-index: 20 !important;
    `;

    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', 'Salvar no Notion');
    button.title = 'Salvar post no Notion';
    button.style.cssText = `
      display: inline-flex !important;
      align-items: center !important;
      gap: 5px !important;
      background: #111827 !important;
      color: #ffffff !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
      border-radius: 9999px !important;
      padding: 4px 11px !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25) !important;
      cursor: pointer !important;
      transition: all 0.15s ease !important;
    `;

    button.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
      </svg>
      <span>Salvar no Notion</span>
    `;

    button.addEventListener('mouseenter', () => {
      button.style.background = '#2563eb';
      button.style.borderColor = '#2563eb';
      button.style.transform = 'scale(1.05)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = '#111827';
      button.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      button.style.transform = 'scale(1)';
    });

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick(button);
    });

    container.appendChild(button);
  }

  return container;
}

/**
 * Atualiza o estado visual do botão para 'salvo com sucesso'
 */
export function markBadgeSaved(buttonEl: HTMLElement) {
  buttonEl.style.background = '#059669';
  buttonEl.style.color = '#ffffff';
  buttonEl.style.borderColor = '#059669';
  buttonEl.innerHTML = `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
    <span>Salvo!</span>
  `;

  setTimeout(() => {
    buttonEl.style.background = '';
    buttonEl.style.color = '';
    buttonEl.style.borderColor = '';
    buttonEl.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
      </svg>
      <span>Salvar</span>
    `;
  }, 4000);
}

/**
 * Configura o observador contínuo para injetar badges nos feeds e posts do Twitter/X e Instagram
 */
export function initSocialMediaBadges(onSavePost: (post: SocialPostData, btn: HTMLElement) => void): () => void {
  const platform = getSocialPlatform();
  if (!platform) return () => {};

  let active = true;

  function scanAndInject() {
    if (!active) return;

    if (platform === 'twitter') {
      const tweets = document.querySelectorAll<HTMLElement>('article[data-testid="tweet"]');
      tweets.forEach((tweet) => {
        if (tweet.dataset.notionSaveInjected === 'true') return;

        const actionBar = tweet.querySelector('div[role="group"]');
        if (actionBar) {
          tweet.dataset.notionSaveInjected = 'true';
          const badge = createSocialBadgeElement('twitter', (btn) => {
            const data = extractTwitterTweet(btn);
            if (data) {
              onSavePost(data, btn);
            }
          });
          actionBar.appendChild(badge);
        }
      });
    } else if (platform === 'instagram') {
      const postElements = document.querySelectorAll<HTMLElement>('article, div[role="dialog"]');
      postElements.forEach((post) => {
        if (post.dataset.notionSaveInjected === 'true') return;

        const hasPostLink = post.querySelector('a[href*="/p/"], a[href*="/reel/"]');
        const isSinglePostPage =
          window.location.pathname.startsWith('/p/') || window.location.pathname.startsWith('/reel/');

        if (!hasPostLink && !isSinglePostPage) return;

        const actionSection = post.querySelector('section');
        const bookmarkBtn = post
          .querySelector('svg[aria-label="Salvar"], svg[aria-label="Save"]')
          ?.closest('div[role="button"], button');

        post.dataset.notionSaveInjected = 'true';

        const badge = createSocialBadgeElement('instagram', (btn) => {
          const data = extractInstagramPost(btn);
          if (data) {
            onSavePost(data, btn);
          }
        });

        if (bookmarkBtn && bookmarkBtn.parentElement) {
          bookmarkBtn.parentElement.style.display = 'flex';
          bookmarkBtn.parentElement.style.alignItems = 'center';
          bookmarkBtn.parentElement.style.gap = '8px';
          bookmarkBtn.parentElement.appendChild(badge);
        } else if (actionSection) {
          actionSection.style.display = 'flex';
          actionSection.style.alignItems = 'center';
          actionSection.style.justifyContent = 'space-between';
          actionSection.appendChild(badge);
        } else {
          badge.style.position = 'absolute';
          badge.style.top = '12px';
          badge.style.right = '12px';
          post.style.position = 'relative';
          post.appendChild(badge);
        }
      });
    }
  }

  scanAndInject();

  let timer: any = null;
  const observer = new MutationObserver(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(scanAndInject, 200);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return () => {
    active = false;
    observer.disconnect();
    if (timer) clearTimeout(timer);
  };
}

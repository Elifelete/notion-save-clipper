/**
 * Conversor de HTML e nós DOM para blocos estruturados da Notion API v1
 */

interface NotionRichTextItem {
  type: 'text';
  text: {
    content: string;
    link?: { url: string } | null;
  };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
  };
}

/**
 * Converte elementos inline com formatação (strong, em, code, a) para Notion rich_text
 */
export function domToRichText(node: Node): NotionRichTextItem[] {
  const result: NotionRichTextItem[] = [];

  function traverse(
    currNode: Node,
    annotations: NotionRichTextItem['annotations'] = {},
    linkUrl?: string
  ) {
    if (currNode.nodeType === Node.TEXT_NODE) {
      const text = currNode.textContent || '';
      if (!text) return;

      // Notion API aceita no máximo 2000 caracteres por bloco de texto
      const chunks = text.match(/.{1,1900}/g) || [text];
      for (const chunk of chunks) {
        result.push({
          type: 'text',
          text: {
            content: chunk,
            link: linkUrl ? { url: linkUrl } : undefined,
          },
          annotations: Object.keys(annotations).length > 0 ? annotations : undefined,
        });
      }
      return;
    }

    if (currNode.nodeType === Node.ELEMENT_NODE) {
      const el = currNode as HTMLElement;
      const tag = el.tagName.toLowerCase();

      const newAnnotations = { ...annotations };
      let newLinkUrl = linkUrl;

      if (tag === 'strong' || tag === 'b') newAnnotations.bold = true;
      if (tag === 'em' || tag === 'i') newAnnotations.italic = true;
      if (tag === 's' || tag === 'del' || tag === 'strike') newAnnotations.strikethrough = true;
      if (tag === 'u') newAnnotations.underline = true;
      if (tag === 'code') newAnnotations.code = true;
      if (tag === 'a') {
        const href = el.getAttribute('href');
        if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
          newLinkUrl = href;
        }
      }

      for (const child of Array.from(el.childNodes)) {
        traverse(child, newAnnotations, newLinkUrl);
      }
    }
  }

  traverse(node);

  if (result.length === 0) {
    const rawText = node.textContent?.trim() || '';
    if (rawText) {
      result.push({
        type: 'text',
        text: { content: rawText.slice(0, 1900) },
      });
    }
  }

  return result;
}

/**
 * Converte HTML de um artigo para um array de blocos nativos do Notion
 */
export function htmlToNotionBlocks(htmlString: string): any[] {
  if (!htmlString || typeof window === 'undefined') return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  const blocks: any[] = [];

  function processElement(el: HTMLElement) {
    const tag = el.tagName.toLowerCase();

    // 1. Títulos
    if (tag === 'h1') {
      const richText = domToRichText(el);
      if (richText.length > 0) {
        blocks.push({
          object: 'block',
          type: 'heading_1',
          heading_1: { rich_text: richText },
        });
      }
      return;
    }

    if (tag === 'h2') {
      const richText = domToRichText(el);
      if (richText.length > 0) {
        blocks.push({
          object: 'block',
          type: 'heading_2',
          heading_2: { rich_text: richText },
        });
      }
      return;
    }

    if (tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
      const richText = domToRichText(el);
      if (richText.length > 0) {
        blocks.push({
          object: 'block',
          type: 'heading_3',
          heading_3: { rich_text: richText },
        });
      }
      return;
    }

    // 2. Parágrafos
    if (tag === 'p') {
      const richText = domToRichText(el);
      if (richText.length > 0) {
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: { rich_text: richText },
        });
      }
      return;
    }

    // 3. Citações (Blockquote)
    if (tag === 'blockquote') {
      const richText = domToRichText(el);
      if (richText.length > 0) {
        blocks.push({
          object: 'block',
          type: 'quote',
          quote: { rich_text: richText },
        });
      }
      return;
    }

    // 4. Listas não-ordenadas (ul)
    if (tag === 'ul') {
      const lis = el.querySelectorAll(':scope > li');
      for (const li of Array.from(lis)) {
        const richText = domToRichText(li);
        if (richText.length > 0) {
          blocks.push({
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: { rich_text: richText },
          });
        }
      }
      return;
    }

    // 5. Listas numeradas (ol)
    if (tag === 'ol') {
      const lis = el.querySelectorAll(':scope > li');
      for (const li of Array.from(lis)) {
        const richText = domToRichText(li);
        if (richText.length > 0) {
          blocks.push({
            object: 'block',
            type: 'numbered_list_item',
            numbered_list_item: { rich_text: richText },
          });
        }
      }
      return;
    }

    // 6. Blocos de Código (pre code)
    if (tag === 'pre') {
      const codeEl = el.querySelector('code') || el;
      const codeText = codeEl.textContent || '';
      if (codeText.trim()) {
        blocks.push({
          object: 'block',
          type: 'code',
          code: {
            rich_text: [{ type: 'text', text: { content: codeText.slice(0, 1900) } }],
            language: 'plain text',
          },
        });
      }
      return;
    }

    // 7. Imagens (img)
    if (tag === 'img') {
      const src = el.getAttribute('src');
      if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
        blocks.push({
          object: 'block',
          type: 'image',
          image: {
            type: 'external',
            external: { url: src },
          },
        });
      }
      return;
    }

    // 8. Divisores (hr)
    if (tag === 'hr') {
      blocks.push({
        object: 'block',
        type: 'divider',
        divider: {},
      });
      return;
    }

    // Recursão para elementos contêineres como div, section, article, main
    for (const child of Array.from(el.children)) {
      if (blocks.length >= 95) break; // Limite de segurança de blocos por requisição
      processElement(child as HTMLElement);
    }
  }

  for (const topChild of Array.from(doc.body.children)) {
    if (blocks.length >= 95) break;
    processElement(topChild as HTMLElement);
  }

  return blocks;
}

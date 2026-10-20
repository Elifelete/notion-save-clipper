/**
 * Converter from HTML and DOM nodes to structured Notion API v1 blocks
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
 * Converts inline elements with formatting (strong, em, code, a) to Notion rich_text
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

      // Notion API accepts at most 2000 characters per text block
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
 * Converts article HTML to an array of native Notion blocks
 */
export function htmlToNotionBlocks(htmlString: string): any[] {
  if (!htmlString || typeof window === 'undefined') return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  const blocks: any[] = [];

  function processElement(el: HTMLElement) {
    const tag = el.tagName.toLowerCase();

    // 1. Headings
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

    // 2. Paragraphs
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

    // 3. Quotes (Blockquote)
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

    // 4. Bulleted Lists (ul)
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

    // 5. Numbered Lists (ol)
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

    // 6. Code Blocks (pre code)
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

    // 7. Images (img)
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

    // 8. Dividers (hr)
    if (tag === 'hr') {
      blocks.push({
        object: 'block',
        type: 'divider',
        divider: {},
      });
      return;
    }

    // Recursion for container elements (div, section, article, main)
    for (const child of Array.from(el.children)) {
      if (blocks.length >= 95) break; // Block safety threshold per request
      processElement(child as HTMLElement);
    }
  }

  for (const topChild of Array.from(doc.body.children)) {
    if (blocks.length >= 95) break;
    processElement(topChild as HTMLElement);
  }

  return blocks;
}

export interface NotionColorStyle {
  bg: string;
  text: string;
  border: string;
}

export const NOTION_COLORS: Record<string, NotionColorStyle> = {
  default: { bg: '#f1f1ef', text: '#37352f', border: '#e3e2e0' },
  gray: { bg: '#e3e2e0', text: '#32302c', border: '#d3d2d0' },
  brown: { bg: '#eee0da', text: '#442a1e', border: '#e0d0c8' },
  orange: { bg: '#fadec9', text: '#49290e', border: '#f3d0b5' },
  yellow: { bg: '#fbf3db', text: '#402c1b', border: '#f4e7c5' },
  green: { bg: '#ddedea', text: '#1e382b', border: '#cce3dd' },
  blue: { bg: '#d3e5ef', text: '#183347', border: '#c0d9e8' },
  purple: { bg: '#e8deee', text: '#412454', border: '#dccfe6' },
  pink: { bg: '#f5e0e9', text: '#4c2337', border: '#edd2e0' },
  red: { bg: '#ffe2dd', text: '#5d1715', border: '#f7d2cc' },
};

const DEFAULT_COLOR: NotionColorStyle = {
  bg: '#f1f1ef',
  text: '#37352f',
  border: '#e3e2e0',
};

export function getNotionColor(colorName?: string): NotionColorStyle {
  if (!colorName) return DEFAULT_COLOR;
  return NOTION_COLORS[colorName] || DEFAULT_COLOR;
}

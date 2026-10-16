import type { NotionDatabase, NotionPropertySchema } from '../types';

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

interface NotionRequestOptions {
  method?: string;
  body?: any;
}

export class NotionApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'NotionApiError';
    this.status = status;
    this.code = code;
  }
}

async function notionRequest<T>(
  apiKey: string,
  endpoint: string,
  options: NotionRequestOptions = {}
): Promise<T> {
  const token = apiKey.trim();
  if (!token) {
    throw new NotionApiError('Chave de API do Notion não informada.', 401);
  }

  const url = `${NOTION_API_BASE}${endpoint}`;
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.message || `Erro na API do Notion (${response.status})`;
    throw new NotionApiError(errorMsg, response.status, data.code);
  }

  return data as T;
}

/**
 * Valida a chave de API testando uma chamada simples
 */
export async function validateNotionApiKey(apiKey: string): Promise<{ valid: boolean; botName?: string; error?: string }> {
  try {
    const data = await notionRequest<{ name?: string; bot?: { owner?: any } }>(apiKey, '/users/me');
    return {
      valid: true,
      botName: data.name || 'Integração Notion',
    };
  } catch (err: any) {
    return {
      valid: false,
      error: err.message || 'Falha ao validar token do Notion',
    };
  }
}

/**
 * Busca todas as databases que a integração tem acesso
 */
export async function fetchDatabases(apiKey: string): Promise<NotionDatabase[]> {
  const data = await notionRequest<{
    results: any[];
  }>(apiKey, '/search', {
    method: 'POST',
    body: {
      filter: {
        value: 'database',
        property: 'object',
      },
      page_size: 100,
    },
  });

  return data.results.map((db: any) => {
    let title = 'Sem título';
    if (db.title && Array.isArray(db.title) && db.title.length > 0) {
      title = db.title.map((t: any) => t.plain_text).join('');
    }

    let icon = '📁';
    if (db.icon?.type === 'emoji') {
      icon = db.icon.emoji;
    } else if (db.icon?.type === 'external') {
      icon = db.icon.external.url;
    }

    const properties: Record<string, NotionPropertySchema> = {};
    if (db.properties) {
      for (const [key, prop] of Object.entries<any>(db.properties)) {
        properties[key] = {
          id: prop.id,
          name: prop.name,
          type: prop.type,
          select: prop.select,
          multi_select: prop.multi_select,
          status: prop.status,
        };
      }
    }

    return {
      id: db.id,
      title: title || 'Base de Dados sem nome',
      icon,
      properties,
    };
  });
}

/**
 * Obtém os detalhes e schema de uma database específica
 */
export async function getDatabaseSchema(apiKey: string, databaseId: string): Promise<NotionDatabase> {
  const db = await notionRequest<any>(apiKey, `/databases/${databaseId}`);

  let title = 'Sem título';
  if (db.title && Array.isArray(db.title) && db.title.length > 0) {
    title = db.title.map((t: any) => t.plain_text).join('');
  }

  const properties: Record<string, NotionPropertySchema> = {};
  if (db.properties) {
    for (const [key, prop] of Object.entries<any>(db.properties)) {
      properties[key] = {
        id: prop.id,
        name: prop.name,
        type: prop.type,
        select: prop.select,
        multi_select: prop.multi_select,
        status: prop.status,
      };
    }
  }

  return {
    id: db.id,
    title,
    properties,
  };
}

/**
 * Formata um valor simples para o payload da Notion API
 */
export function formatNotionPropertyValue(type: string, value: any) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  switch (type) {
    case 'title':
      return {
        title: [
          {
            text: {
              content: String(value).slice(0, 2000),
            },
          },
        ],
      };
    case 'rich_text':
      return {
        rich_text: [
          {
            text: {
              content: String(value).slice(0, 2000),
            },
          },
        ],
      };
    case 'url':
      return {
        url: String(value),
      };
    case 'select':
      return {
        select: {
          name: String(value),
        },
      };
    case 'multi_select': {
      const items = Array.isArray(value) ? value : [value];
      return {
        multi_select: items.map((item) => ({ name: String(item) })),
      };
    }
    case 'date':
      return {
        date: {
          start: String(value),
        },
      };
    case 'checkbox':
      return {
        checkbox: Boolean(value),
      };
    case 'number':
      return {
        number: Number(value),
      };
    case 'status':
      return {
        status: {
          name: String(value),
        },
      };
    default:
      return null;
  }
}

export interface CreatePageParams {
  apiKey: string;
  databaseId: string;
  properties: Record<string, { type: string; value: any }>;
  coverUrl?: string;
  iconUrl?: string;
  contentBlocks?: any[];
}

/**
 * Cria uma nova página na Database do Notion
 */
export async function createPage(params: CreatePageParams): Promise<{ id: string; url: string }> {
  const { apiKey, databaseId, properties, coverUrl, iconUrl, contentBlocks } = params;

  const formattedProperties: Record<string, any> = {};

  for (const [propName, propData] of Object.entries(properties)) {
    const formatted = formatNotionPropertyValue(propData.type, propData.value);
    if (formatted) {
      formattedProperties[propName] = formatted;
    }
  }

  const payload: any = {
    parent: { database_id: databaseId },
    properties: formattedProperties,
  };

  if (coverUrl && coverUrl.startsWith('http')) {
    payload.cover = {
      type: 'external',
      external: {
        url: coverUrl,
      },
    };
  }

  if (iconUrl && iconUrl.startsWith('http')) {
    payload.icon = {
      type: 'external',
      external: {
        url: iconUrl,
      },
    };
  }

  if (contentBlocks && contentBlocks.length > 0) {
    // Notion API limita o primeiro lote a 100 blocos
    payload.children = contentBlocks.slice(0, 100);
  }

  const response = await notionRequest<any>(apiKey, '/pages', {
    method: 'POST',
    body: payload,
  });

  return {
    id: response.id,
    url: response.url,
  };
}

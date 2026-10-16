import type { NotionDestination, NotionPropertySchema, NotionDestinationType, PageSaveMode } from '../types';

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

const parentCache = new Map<string, { title: string; parentId?: string; parentType?: string }>();

async function resolveParentInfo(
  apiKey: string,
  parentId: string,
  parentType?: string
): Promise<{ title: string; parentId?: string; parentType?: string } | null> {
  if (parentCache.has(parentId)) {
    return parentCache.get(parentId)!;
  }

  try {
    if (parentType === 'database_id') {
      const db = await notionRequest<any>(apiKey, `/databases/${parentId}`);
      let title = 'Base de Dados';
      if (db.title && Array.isArray(db.title) && db.title.length > 0) {
        title = db.title.map((t: any) => t.plain_text).join('');
      }
      const info = {
        title,
        parentId: db.parent?.page_id || db.parent?.database_id || db.parent?.block_id,
        parentType: db.parent?.type,
      };
      parentCache.set(parentId, info);
      return info;
    } else {
      const page = await notionRequest<any>(apiKey, `/pages/${parentId}`);
      let title = 'Página';
      if (page.properties) {
        for (const prop of Object.values<any>(page.properties)) {
          if (prop.type === 'title' && Array.isArray(prop.title) && prop.title.length > 0) {
            title = prop.title.map((t: any) => t.plain_text).join('');
            break;
          }
        }
      }
      const info = {
        title,
        parentId: page.parent?.page_id || page.parent?.database_id || page.parent?.block_id,
        parentType: page.parent?.type,
      };
      parentCache.set(parentId, info);
      return info;
    }
  } catch {
    return null;
  }
}

interface RawNotionSearchItem {
  id: string;
  title: string;
  icon?: string;
  type: NotionDestinationType;
  parentId?: string;
  parentType?: string;
  url?: string;
  properties?: Record<string, NotionPropertySchema>;
}

/**
 * Busca todas as databases E páginas que a integração tem acesso, calculando hierarquia e caminhos
 */
export async function fetchDestinations(apiKey: string): Promise<NotionDestination[]> {
  const data = await notionRequest<{
    results: any[];
  }>(apiKey, '/search', {
    method: 'POST',
    body: {
      page_size: 100,
      sort: {
        direction: 'descending',
        timestamp: 'last_edited_time',
      },
    },
  });

  const rawItems: RawNotionSearchItem[] = [];
  const idToItemMap = new Map<string, RawNotionSearchItem>();

  for (const item of data.results) {
    let icon = '📄';
    if (item.icon?.type === 'emoji') {
      icon = item.icon.emoji;
    } else if (item.icon?.type === 'external') {
      icon = item.icon.external.url;
    }

    const parentId = item.parent?.page_id || item.parent?.database_id || item.parent?.block_id;
    const parentType = item.parent?.type;
    const itemUrl = item.url || `https://www.notion.so/${item.id.replace(/-/g, '')}`;

    if (item.object === 'database') {
      let title = 'Base de Dados sem nome';
      if (item.title && Array.isArray(item.title) && item.title.length > 0) {
        title = item.title.map((t: any) => t.plain_text).join('');
      }

      const properties: Record<string, NotionPropertySchema> = {};
      if (item.properties) {
        for (const [key, prop] of Object.entries<any>(item.properties)) {
          properties[key] = {
            id: prop.id,
            name: prop.name,
            type: prop.type,
            select: prop.select,
            multi_select: prop.multi_select,
            status: prop.status,
            options: prop.multi_select?.options || prop.select?.options || prop.status?.options || [],
          };
        }
      }

      const parsed: RawNotionSearchItem = {
        id: item.id,
        title: title || 'Base de Dados sem nome',
        icon: item.icon ? icon : '📁',
        type: 'database',
        parentId,
        parentType,
        url: itemUrl,
        properties,
      };

      rawItems.push(parsed);
      idToItemMap.set(item.id, parsed);
    } else if (item.object === 'page') {
      // Ignora páginas que são apenas linhas internas de uma Database
      if (item.parent?.type === 'database_id') {
        continue;
      }

      // Extrai o título da página
      let title = 'Página sem nome';
      if (item.properties) {
        for (const prop of Object.values<any>(item.properties)) {
          if (prop.type === 'title' && Array.isArray(prop.title) && prop.title.length > 0) {
            title = prop.title.map((t: any) => t.plain_text).join('');
            break;
          }
        }
      }

      const parsed: RawNotionSearchItem = {
        id: item.id,
        title: title || 'Página sem nome',
        icon: item.icon ? icon : '📄',
        type: 'page',
        parentId,
        parentType,
        url: itemUrl,
      };

      rawItems.push(parsed);
      idToItemMap.set(item.id, parsed);
    }
  }

  // Resolve pais ausentes que não foram retornados diretamente na busca inicial
  const missingParents = new Set<string>();
  for (const item of rawItems) {
    if (item.parentId && !idToItemMap.has(item.parentId) && item.parentType !== 'workspace') {
      missingParents.add(item.parentId);
    }
  }

  if (missingParents.size > 0) {
    await Promise.all(
      Array.from(missingParents).map(async (pId) => {
        const sampleItem = rawItems.find((r) => r.parentId === pId);
        const info = await resolveParentInfo(apiKey, pId, sampleItem?.parentType);
        if (info) {
          idToItemMap.set(pId, {
            id: pId,
            title: info.title,
            type: 'page',
            parentId: info.parentId,
            parentType: info.parentType,
          });
        }
      })
    );
  }

  // Constrói breadcrumb hierárquico com caminho completo (ex: "Workspace / Projetos / sites")
  const destinations: NotionDestination[] = rawItems.map((item) => {
    const pathParts: string[] = [];
    let currParentId = item.parentId;

    while (currParentId && idToItemMap.has(currParentId) && pathParts.length < 4) {
      const parentObj = idToItemMap.get(currParentId)!;
      pathParts.unshift(parentObj.title);
      currParentId = parentObj.parentId;
    }

    let path = 'Workspace';
    if (pathParts.length === 1) {
      path = `Workspace / ${pathParts[0]}`;
    } else if (pathParts.length === 2) {
      path = `Workspace / ${pathParts[0]} / ${pathParts[1]}`;
    } else if (pathParts.length >= 3) {
      path = `Workspace / ... / ${pathParts[pathParts.length - 1]}`;
    } else if (item.parentType === 'workspace') {
      path = 'Workspace (Raiz)';
    }

    return {
      id: item.id,
      title: item.title,
      icon: item.icon,
      type: item.type,
      path,
      url: item.url || `https://www.notion.so/${item.id.replace(/-/g, '')}`,
      properties: item.properties,
    };
  });

  return destinations;
}

// Mantém retrocompatibilidade de chamada
export const fetchDatabases = fetchDestinations;

/**
 * Atualiza a lista de opções de uma propriedade Select ou Multi-Select na database do Notion
 */
export async function updateDatabasePropertyOptions(
  apiKey: string,
  databaseId: string,
  propertyName: string,
  propertyType: 'select' | 'multi_select',
  options: Array<{ id?: string; name: string; color?: string }>
): Promise<void> {
  await notionRequest<any>(apiKey, `/databases/${databaseId}`, {
    method: 'PATCH',
    body: {
      properties: {
        [propertyName]: {
          [propertyType]: {
            options: options.map((opt) => ({
              name: opt.name,
              color: opt.color || 'default',
            })),
          },
        },
      },
    },
  });
}

/**
 * Obtém os detalhes e schema de uma database específica
 */
export async function getDatabaseSchema(apiKey: string, databaseId: string): Promise<NotionDestination> {
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
            options: prop.multi_select?.options || prop.select?.options || prop.status?.options || [],
      };
    }
  }

  return {
    id: db.id,
    title,
    icon: db.icon?.emoji || '📁',
    type: 'database',
    url: db.url || `https://www.notion.so/${db.id.replace(/-/g, '')}`,
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
  destinationType?: NotionDestinationType;
  destinationId: string;
  pageSaveMode?: PageSaveMode;
  title: string;
  url?: string;
  description?: string;
  properties?: Record<string, { type: string; value: any }>;
  coverUrl?: string;
  iconUrl?: string;
  contentBlocks?: any[];
}

/**
 * Salva no Notion: em Database ou em Página comum (Sub-página ou Append), com suporte a paginação de blocos
 */
export async function createPage(params: CreatePageParams): Promise<{ id: string; url: string }> {
  const {
    apiKey,
    destinationType = 'database',
    destinationId,
    pageSaveMode = 'subpage',
    title,
    url,
    description,
    properties = {},
    coverUrl,
    iconUrl,
    contentBlocks = [],
  } = params;

  // CASO 1: Destino é uma PÁGINA e o modo é Inserir no final da página (Append)
  if (destinationType === 'page' && pageSaveMode === 'append_block') {
    const blocksToAppend: any[] = [];

    // Bloco Callout ou Bookmark com o link
    if (url) {
      blocksToAppend.push({
        object: 'block',
        type: 'bookmark',
        bookmark: {
          url: url,
        },
      });
    }

    if (description) {
      blocksToAppend.push({
        object: 'block',
        type: 'quote',
        quote: {
          rich_text: [{ type: 'text', text: { content: description } }],
        },
      });
    }

    if (contentBlocks.length > 0) {
      blocksToAppend.push(...contentBlocks);
    }

    // Envia o primeiro lote de até 100 blocos
    await notionRequest<any>(apiKey, `/blocks/${destinationId}/children`, {
      method: 'PATCH',
      body: {
        children: blocksToAppend.slice(0, 100),
      },
    });

    // Se houver mais de 100 blocos, anexa os excedentes em lotes subsequentes
    if (blocksToAppend.length > 100) {
      for (let i = 100; i < blocksToAppend.length; i += 100) {
        const batch = blocksToAppend.slice(i, i + 100);
        await notionRequest<any>(apiKey, `/blocks/${destinationId}/children`, {
          method: 'PATCH',
          body: { children: batch },
        });
      }
    }

    const pageDetails = await notionRequest<any>(apiKey, `/pages/${destinationId}`);
    return {
      id: destinationId,
      url: pageDetails.url || `https://notion.so/${destinationId.replace(/-/g, '')}`,
    };
  }

  // CASO 2: Destino é uma PÁGINA como Sub-página
  if (destinationType === 'page') {
    const payload: any = {
      parent: { page_id: destinationId },
      properties: {
        title: {
          title: [{ type: 'text', text: { content: title || 'Página salva' } }],
        },
      },
    };

    if (coverUrl && coverUrl.startsWith('http')) {
      payload.cover = {
        type: 'external',
        external: { url: coverUrl },
      };
    }

    if (iconUrl && iconUrl.startsWith('http')) {
      payload.icon = {
        type: 'external',
        external: { url: iconUrl },
      };
    }

    if (contentBlocks && contentBlocks.length > 0) {
      payload.children = contentBlocks.slice(0, 100);
    }

    const response = await notionRequest<any>(apiKey, '/pages', {
      method: 'POST',
      body: payload,
    });

    // Anexa blocos excedentes (acima de 100)
    if (contentBlocks && contentBlocks.length > 100) {
      for (let i = 100; i < contentBlocks.length; i += 100) {
        const batch = contentBlocks.slice(i, i + 100);
        await notionRequest<any>(apiKey, `/blocks/${response.id}/children`, {
          method: 'PATCH',
          body: { children: batch },
        });
      }
    }

    return {
      id: response.id,
      url: response.url,
    };
  }

  // CASO 3: Destino é uma DATABASE
  const formattedProperties: Record<string, any> = {};

  for (const [propName, propData] of Object.entries(properties)) {
    const formatted = formatNotionPropertyValue(propData.type, propData.value);
    if (formatted) {
      formattedProperties[propName] = formatted;
    }
  }

  const payload: any = {
    parent: { database_id: destinationId },
    properties: formattedProperties,
  };

  if (coverUrl && coverUrl.startsWith('http')) {
    payload.cover = {
      type: 'external',
      external: { url: coverUrl },
    };
  }

  if (iconUrl && iconUrl.startsWith('http')) {
    payload.icon = {
      type: 'external',
      external: { url: iconUrl },
    };
  }

  if (contentBlocks && contentBlocks.length > 0) {
    payload.children = contentBlocks.slice(0, 100);
  }

  const response = await notionRequest<any>(apiKey, '/pages', {
    method: 'POST',
    body: payload,
  });

  // Anexa blocos excedentes (acima de 100)
  if (contentBlocks && contentBlocks.length > 100) {
    for (let i = 100; i < contentBlocks.length; i += 100) {
      const batch = contentBlocks.slice(i, i + 100);
      await notionRequest<any>(apiKey, `/blocks/${response.id}/children`, {
        method: 'PATCH',
        body: { children: batch },
      });
    }
  }

  return {
    id: response.id,
    url: response.url,
  };
}

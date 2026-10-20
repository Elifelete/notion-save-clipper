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
    throw new NotionApiError('Notion API key not provided.', 401);
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
    const errorMsg = data.message || `Notion API error (${response.status})`;
    throw new NotionApiError(errorMsg, response.status, data.code);
  }

  return data as T;
}

/**
 * Validates the API key by testing a basic call
 */
export async function validateNotionApiKey(apiKey: string): Promise<{ valid: boolean; botName?: string; error?: string }> {
  try {
    const data = await notionRequest<{ name?: string; bot?: { owner?: any } }>(apiKey, '/users/me');
    return {
      valid: true,
      botName: data.name || 'Notion Integration',
    };
  } catch (err: any) {
    return {
      valid: false,
      error: err.message || 'Failed to validate Notion token',
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
      let title = 'Database';
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
      let title = 'Page';
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
 * Searches Notion objects with full pagination and type filter ('database' or 'page')
 */
async function searchNotionObjects(
  apiKey: string,
  objectType: 'database' | 'page',
  maxItems = 300
): Promise<any[]> {
  const items: any[] = [];
  let startCursor: string | undefined = undefined;
  let hasMore = true;

  while (hasMore && items.length < maxItems) {
    try {
      const body: Record<string, any> = {
        page_size: 100,
        filter: {
          property: 'object',
          value: objectType,
        },
        sort: {
          direction: 'descending',
          timestamp: 'last_edited_time',
        },
      };

      if (startCursor) {
        body.start_cursor = startCursor;
      }

      const response = await notionRequest<{
        results: any[];
        has_more: boolean;
        next_cursor: string | null;
      }>(apiKey, '/search', {
        method: 'POST',
        body,
      });

      if (response.results && response.results.length > 0) {
        items.push(...response.results);
      }

      hasMore = Boolean(response.has_more && response.next_cursor);
      startCursor = response.next_cursor || undefined;
    } catch (err) {
      console.warn(`Error fetching paginated ${objectType}s from Notion:`, err);
      break;
    }
  }

  return items;
}

/**
 * Converts raw Notion items into NotionDestination with hierarchy and breadcrumbs
 */
async function parseRawItemsToDestinations(
  apiKey: string,
  results: any[]
): Promise<NotionDestination[]> {
  const rawItems: RawNotionSearchItem[] = [];
  const idToItemMap = new Map<string, RawNotionSearchItem>();

  for (const item of results) {
    if (idToItemMap.has(item.id)) continue;

    let icon = item.object === 'database' ? '📁' : '📄';
    if (item.icon?.type === 'emoji') {
      icon = item.icon.emoji;
    } else if (item.icon?.type === 'external') {
      icon = item.icon.external?.url || icon;
    } else if (item.icon?.type === 'file') {
      icon = item.icon.file?.url || icon;
    }

    const parentId = item.parent?.page_id || item.parent?.database_id || item.parent?.block_id;
    const parentType = item.parent?.type;
    const itemUrl = item.url || `https://www.notion.so/${item.id.replace(/-/g, '')}`;

    if (item.object === 'database') {
      let title = 'Untitled Database';
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
        title: title || 'Untitled Database',
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
      let title = '';
      if (item.properties) {
        for (const prop of Object.values<any>(item.properties)) {
          if (prop.type === 'title' && Array.isArray(prop.title) && prop.title.length > 0) {
            title = prop.title.map((t: any) => t.plain_text).join('');
            break;
          }
        }
      }

      if (!title.trim()) {
        continue;
      }

      const parsed: RawNotionSearchItem = {
        id: item.id,
        title: title.trim(),
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

  // Resolves missing parents not returned in initial search
  const missingParents = new Set<string>();
  for (const item of rawItems) {
    if (item.parentId && !idToItemMap.has(item.parentId) && item.parentType !== 'workspace') {
      missingParents.add(item.parentId);
    }
  }

  if (missingParents.size > 0) {
    const parentsToFetch = Array.from(missingParents).slice(0, 20);
    await Promise.all(
      parentsToFetch.map(async (pId) => {
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

  // Builds hierarchical breadcrumbs
  return rawItems.map((item) => {
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
      path = 'Workspace (Root)';
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
}

/**
 * Fetches all databases and pages shared with integration with full pagination
 */
export async function fetchDestinations(apiKey: string): Promise<NotionDestination[]> {
  const [databasesRaw, pagesRaw] = await Promise.all([
    searchNotionObjects(apiKey, 'database', 300),
    searchNotionObjects(apiKey, 'page', 500),
  ]);

  return parseRawItemsToDestinations(apiKey, [...databasesRaw, ...pagesRaw]);
}

/**
 * Searches Notion server by title in real-time
 */
export async function searchNotionByQuery(
  apiKey: string,
  query: string
): Promise<NotionDestination[]> {
  if (!query.trim()) return [];

  try {
    const response = await notionRequest<{ results: any[] }>(apiKey, '/search', {
      method: 'POST',
      body: {
        query: query.trim(),
        page_size: 50,
      },
    });

    return parseRawItemsToDestinations(apiKey, response.results || []);
  } catch (err) {
    console.warn('Error during Notion search query:', err);
    return [];
  }
}

export const fetchDatabases = fetchDestinations;

/**
 * Updates select or multi-select options in Notion database schema
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
 * Fetches schema and properties for a database
 */
export async function getDatabaseSchema(apiKey: string, databaseId: string): Promise<NotionDestination> {
  const db = await notionRequest<any>(apiKey, `/databases/${databaseId}`);

  let title = 'Untitled';
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
 * Formats a property value for Notion API payload
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
 * Saves to Notion: into a database or into a regular page (subpage or append), with block batching
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

  // CASE 1: Destination is a PAGE and mode is Append
  if (destinationType === 'page' && pageSaveMode === 'append_block') {
    const blocksToAppend: any[] = [];

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

    await notionRequest<any>(apiKey, `/blocks/${destinationId}/children`, {
      method: 'PATCH',
      body: {
        children: blocksToAppend.slice(0, 100),
      },
    });

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

  // CASE 2: Destination is a PAGE as Sub-page
  if (destinationType === 'page') {
    const payload: any = {
      parent: { page_id: destinationId },
      properties: {
        title: {
          title: [{ type: 'text', text: { content: title || 'Saved Page' } }],
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

  // CASE 3: Destination is a DATABASE
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

/**
 * Checks if a page with the given URL has already been saved to the database
 */
export async function findExistingPageByUrl(
  apiKey: string,
  destinationId: string,
  destinationType: NotionDestinationType,
  urlToSearch: string
): Promise<{ id: string; url: string; title: string } | null> {
  const cleanUrl = urlToSearch.trim();
  if (!cleanUrl) return null;

  try {
    if (destinationType === 'database') {
      const db = await getDatabaseSchema(apiKey, destinationId);
      const urlProp = Object.values(db.properties || {}).find((p) => p.type === 'url');

      if (urlProp) {
        const queryRes = await notionRequest<{ results: any[] }>(
          apiKey,
          `/databases/${destinationId}/query`,
          {
            method: 'POST',
            body: {
              filter: {
                property: urlProp.name,
                url: {
                  equals: cleanUrl,
                },
              },
              page_size: 1,
            },
          }
        );

        if (queryRes.results && queryRes.results.length > 0) {
          const item = queryRes.results[0];
          let title = 'Existing Item';
          if (item.properties) {
            for (const prop of Object.values<any>(item.properties)) {
              if (prop.type === 'title' && Array.isArray(prop.title) && prop.title.length > 0) {
                title = prop.title.map((t: any) => t.plain_text).join('');
                break;
              }
            }
          }
          return {
            id: item.id,
            url: item.url || `https://notion.so/${item.id.replace(/-/g, '')}`,
            title,
          };
        }
      }
    }

    return null;
  } catch (err) {
    console.warn('Error checking duplicate page:', err);
    return null;
  }
}

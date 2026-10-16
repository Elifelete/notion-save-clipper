export type NotionDestinationType = 'database' | 'page';

export interface NotionDestination {
  id: string;
  title: string;
  icon?: string;
  type: NotionDestinationType;
  path?: string; // Ex: "My Life / ... / Projects" ou "Workspace"
  url?: string;  // URL direta da página ou database no Notion
  properties?: Record<string, NotionPropertySchema>;
}

// Para manter retrocompatibilidade de nomes
export type NotionDatabase = NotionDestination;

export type NotionPropertyType =
  | 'title'
  | 'rich_text'
  | 'number'
  | 'select'
  | 'multi_select'
  | 'date'
  | 'checkbox'
  | 'url'
  | 'email'
  | 'phone_number'
  | 'status'
  | 'created_time'
  | 'created_by'
  | 'last_edited_time'
  | 'last_edited_by'
  | 'relation'
  | 'files';

export interface NotionPropertyOption {
  id: string;
  name: string;
  color: string;
}

export interface NotionPropertySchema {
  id: string;
  name: string;
  type: NotionPropertyType;
  select?: { options: NotionPropertyOption[] };
  multi_select?: { options: NotionPropertyOption[] };
  status?: {
    options: NotionPropertyOption[];
    groups: Array<{ id: string; name: string; option_ids: string[] }>;
  };
  options?: NotionPropertyOption[];
}

export type PropertyDataSource =
  | 'page_title'
  | 'page_url'
  | 'page_description'
  | 'page_author'
  | 'page_date'
  | 'page_site_name'
  | 'fixed_value'
  | 'manual';

export interface PropertyFieldMapping {
  notionPropertyId: string;
  notionPropertyName: string;
  notionPropertyType: NotionPropertyType;
  source: PropertyDataSource;
  defaultValue?: any;
  showInPopup: boolean;
  required?: boolean;
  options?: NotionPropertyOption[];
}

export type PageSaveMode = 'subpage' | 'append_block';

export interface FormConfig {
  id: string;
  name: string;
  icon: string;
  destinationType: NotionDestinationType; // 'database' | 'page'
  databaseId: string;                     // ID da database ou da página de destino
  databaseTitle: string;                  // Nome da database ou da página de destino
  destinationUrl?: string;                // Link direto no Notion
  pageSaveMode?: PageSaveMode;            // 'subpage' ou 'append_block' (usado quando destinationType === 'page')
  clipContent: boolean;                   // true = extrai corpo do artigo, false = bookmark simples
  mappings: PropertyFieldMapping[];
  createdAt: number;
}

export interface ExtractedMetadata {
  title: string;
  url: string;
  description: string;
  coverImage?: string;
  favicon?: string;
  author?: string;
  publishedDate?: string;
  siteName?: string;
  rawText?: string;
}

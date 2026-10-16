export interface NotionDatabase {
  id: string;
  title: string;
  icon?: string;
  description?: string;
  properties: Record<string, NotionPropertySchema>;
}

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

export interface NotionPropertySchema {
  id: string;
  name: string;
  type: NotionPropertyType;
  select?: { options: Array<{ id: string; name: string; color: string }> };
  multi_select?: { options: Array<{ id: string; name: string; color: string }> };
  status?: {
    options: Array<{ id: string; name: string; color: string }>;
    groups: Array<{ id: string; name: string; option_ids: string[] }>;
  };
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
}

export interface FormConfig {
  id: string;
  name: string;
  icon: string;
  databaseId: string;
  databaseTitle: string;
  clipContent: boolean; // true = extrai corpo do artigo, false = bookmark simples
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

export interface UserSettings {
  apiKey: string;
  forms: FormConfig[];
  defaultFormId?: string;
}

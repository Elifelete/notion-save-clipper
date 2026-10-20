export type NotionDestinationType = 'database' | 'page';

export interface NotionDestination {
  id: string;
  title: string;
  icon?: string;
  type: NotionDestinationType;
  path?: string; // e.g. "My Life / ... / Projects" or "Workspace"
  url?: string;  // Direct URL to page or database in Notion
  properties?: Record<string, NotionPropertySchema>;
}

// Backward compatibility alias
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
  databaseId: string;                     // ID of target database or page
  databaseTitle: string;                  // Name of target database or page
  destinationUrl?: string;                // Direct Notion link
  destinationPath?: string;               // Notion folder/breadcrumb path (e.g. "Workspace / ... / Projects")
  showFullPath?: boolean;                 // Show folder path hierarchy in form list
  pageSaveMode?: PageSaveMode;            // 'subpage' or 'append_block' (when destinationType === 'page')
  detectExisting?: boolean;               // Check whether URL already exists in Notion destination
  clipContent: boolean;                   // true = extract article body, false = simple bookmark
  mappings: PropertyFieldMapping[];
  createdAt: number;
}

export interface SocialPostData {
  platform: 'twitter' | 'instagram';
  username: string;
  postId: string;
  postUrl: string;
  caption: string;
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
  selectedText?: string;
  socialPost?: SocialPostData;
}

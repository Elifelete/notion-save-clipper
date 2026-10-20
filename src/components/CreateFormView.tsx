import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Check,
  Plus,
  X,
  Bookmark,
  FileText,
  Database,
  GripVertical,
  MoreHorizontal,
  Calendar,
  User,
  Link2,
  Tag,
  AlignLeft,
  Type,
  Image as ImageIcon,
  FolderPlus,
  ListPlus,
  Loader2,
  Globe,
  Hash,
  ToggleLeft,
  FileSpreadsheet,
  ExternalLink,
  Copy,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import type { NotionDestination, FormConfig, PropertyFieldMapping, PageSaveMode, PropertyDataSource } from '../types';
import { fetchDestinations, getDatabaseSchema, searchNotionByQuery } from '../services/notion';
import { saveForm, deleteForm } from '../services/storage';

interface CreateFormViewProps {
  apiKey: string;
  initialForm?: FormConfig;
  onFormCreated: (form: FormConfig) => void;
  onCancel: () => void;
  onDeleteForm?: (formId: string) => void;
}

const EMOJI_OPTIONS = ['🔖', '📚', '💡', '📌', '🎬', '🍳', '💼', '🚀', '⭐', '🧠', '📄', '📝'];

type FilterType = 'all' | 'database' | 'page';

interface SourceOption {
  source: PropertyDataSource;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SOURCE_OPTIONS: SourceOption[] = [
  { source: 'page_title', label: 'Page Title', icon: Type },
  { source: 'page_description', label: 'Page Description', icon: AlignLeft },
  { source: 'page_url', label: 'Url', icon: Link2 },
  { source: 'page_author', label: 'Author', icon: User },
  { source: 'page_date', label: 'Publication Date', icon: Calendar },
  { source: 'manual', label: 'Empty (Manual)', icon: FileText },
];

export const CreateFormView: React.FC<CreateFormViewProps> = ({
  apiKey,
  initialForm,
  onFormCreated,
  onCancel,
  onDeleteForm,
}) => {
  const [step, setStep] = useState<'configure_form' | 'select_location'>('configure_form');

  // Notion Destinations
  const [destinations, setDestinations] = useState<NotionDestination[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<NotionDestination | null>(null);
  const [databaseProperties, setDatabaseProperties] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form Config
  const [formName, setFormName] = useState(initialForm?.name || '');
  const [formIcon, setFormIcon] = useState(initialForm?.icon || '🔖');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [detectExisting, setDetectExisting] = useState(initialForm?.detectExisting ?? true);
  const [showFullPath, setShowFullPath] = useState(initialForm?.showFullPath ?? false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [clipAction, setClipAction] = useState<'bookmark' | 'article'>(
    initialForm?.clipContent ? 'article' : 'bookmark'
  );
  const [pageSaveMode, setPageSaveMode] = useState<PageSaveMode>(
    initialForm?.pageSaveMode || 'subpage'
  );

  // Field mappings
  const [mappings, setMappings] = useState<PropertyFieldMapping[]>(
    initialForm?.mappings || []
  );
  const [showAllFields, setShowAllFields] = useState(false);

  // Dropdown "+ Add New Field"
  const [isAddFieldOpen, setIsAddFieldOpen] = useState(false);
  const [propertySearchQuery, setPropertySearchQuery] = useState('');

  // Dropdown for selecting source
  const [activeSourceMenuId, setActiveSourceMenuId] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [submitting, setSubmitting] = useState(false);

  const [searchingServer, setSearchingServer] = useState(false);
  const [expandAllDatabases, setExpandAllDatabases] = useState(false);
  const [expandAllPages, setExpandAllPages] = useState(false);
  const [isDatabasesCollapsed, setIsDatabasesCollapsed] = useState(false);
  const [isPagesCollapsed, setIsPagesCollapsed] = useState(false);

  // Debounced live search
  useEffect(() => {
    if (step !== 'select_location') return;
    const query = searchQuery.trim();
    if (query.length < 2) return;

    const timer = setTimeout(async () => {
      try {
        setSearchingServer(true);
        const serverResults = await searchNotionByQuery(apiKey, query);
        if (serverResults.length > 0) {
          setDestinations((prev) => {
            const existingIds = new Set(prev.map((d) => d.id));
            const newItems = serverResults.filter((r) => !existingIds.has(r.id));
            return newItems.length > 0 ? [...prev, ...newItems] : prev;
          });
        }
      } catch (err) {
        console.warn('Error during live Notion search:', err);
      } finally {
        setSearchingServer(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, step, apiKey]);

  // Load destinations
  useEffect(() => {
    async function loadDestinations() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchDestinations(apiKey);
        setDestinations(data);

        if (initialForm) {
          const match = data.find((d) => d.id === initialForm.databaseId);
          if (match) {
            setSelectedDestination(match);
          } else {
            setSelectedDestination({
              id: initialForm.databaseId,
              title: initialForm.databaseTitle,
              icon: initialForm.icon || '📁',
              type: initialForm.destinationType,
              url: initialForm.destinationUrl,
              path: initialForm.destinationPath,
            });
          }
          setFormName(initialForm.name);
          setFormIcon(initialForm.icon || '🔖');
          setMappings(initialForm.mappings || []);
        } else if (data.length > 0 && data[0]) {
          const first = data[0];
          setSelectedDestination(first);
          setFormName(`Save to ${first.title}`);
        } else {
          setStep('select_location');
        }
      } catch (err: any) {
        setError(err.message || 'Error loading Notion destinations.');
      } finally {
        setLoading(false);
      }
    }
    loadDestinations();
  }, [apiKey]);

  // Load schema on selected destination
  useEffect(() => {
    async function loadSchema() {
      if (!selectedDestination) return;

      if (selectedDestination.type === 'database') {
        try {
          const destSchema = await getDatabaseSchema(apiKey, selectedDestination.id);
          const properties = destSchema.properties || selectedDestination.properties || {};
          setDatabaseProperties(properties);

          if (initialForm && initialForm.databaseId === selectedDestination.id && mappings.length > 0) {
            return;
          }

          const initialMappings: PropertyFieldMapping[] = [];

          for (const [propName, prop] of Object.entries(properties) as [string, any][]) {
            const pType = prop?.type;
            const pId = prop?.id || propName;
            const lowerName = propName.toLowerCase();

            if (pType === 'title') {
              initialMappings.push({
                notionPropertyId: pId,
                notionPropertyName: propName,
                notionPropertyType: 'title',
                source: 'page_title',
                showInPopup: true,
                required: true,
              });
            } else if (pType === 'url' || lowerName === 'url' || lowerName === 'link') {
              initialMappings.push({
                notionPropertyId: pId,
                notionPropertyName: propName,
                notionPropertyType: pType || 'url',
                source: 'page_url',
                showInPopup: true,
              });
            } else if (
              lowerName === 'description' ||
              lowerName === 'descrição' ||
              lowerName === 'descricao' ||
              lowerName === 'resumo' ||
              lowerName === 'caption' ||
              lowerName === 'legenda'
            ) {
              initialMappings.push({
                notionPropertyId: pId,
                notionPropertyName: propName,
                notionPropertyType: pType || 'rich_text',
                source: 'page_description',
                showInPopup: true,
              });
            } else if (pType === 'multi_select' || pType === 'select') {
              initialMappings.push({
                notionPropertyId: pId,
                notionPropertyName: propName,
                notionPropertyType: pType,
                options: prop?.options || prop?.multi_select?.options || prop?.select?.options || undefined,
                source: 'manual',
                showInPopup: true,
              });
            }
          }

          setMappings(initialMappings);
        } catch (err) {
          console.error('Error reading database properties:', err);
        }
      } else {
        setDatabaseProperties({});
        if (initialForm && initialForm.databaseId === selectedDestination.id && mappings.length > 0) {
          return;
        }
        setMappings([
          {
            notionPropertyId: 'title',
            notionPropertyName: 'Name',
            notionPropertyType: 'title',
            source: 'page_title',
            showInPopup: true,
            required: true,
          },
          {
            notionPropertyId: 'url',
            notionPropertyName: 'URL',
            notionPropertyType: 'url',
            source: 'page_url',
            showInPopup: true,
          },
        ]);
      }
    }

    loadSchema();
  }, [apiKey, selectedDestination]);

  const moveField = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= mappings.length || fromIndex === toIndex) return;
    setMappings((prev) => {
      const updated = [...prev];
      const [movedItem] = updated.splice(fromIndex, 1);
      if (movedItem) updated.splice(toIndex, 0, movedItem);
      return updated;
    });
  };

  const handleDuplicateForm = async () => {
    setIsMoreMenuOpen(false);
    if (!selectedDestination) return;
    try {
      const duplicated: FormConfig = {
        id: crypto.randomUUID(),
        name: `${formName} (Copy)`,
        icon: formIcon,
        destinationType: selectedDestination.type,
        databaseId: selectedDestination.id,
        databaseTitle: selectedDestination.title,
        destinationUrl: selectedDestination.url,
        destinationPath: selectedDestination.path || initialForm?.destinationPath,
        showFullPath,
        pageSaveMode: selectedDestination.type === 'page' ? pageSaveMode : undefined,
        detectExisting,
        clipContent: clipAction === 'article',
        mappings: [...mappings],
        createdAt: Date.now(),
      };
      await saveForm(duplicated);
      onFormCreated(duplicated);
    } catch (err: any) {
      alert(`Error duplicating: ${err.message}`);
    }
  };

  const handleResetFields = () => {
    setIsMoreMenuOpen(false);
    if (!selectedDestination) return;

    if (selectedDestination.type === 'database') {
      const initialMappings: PropertyFieldMapping[] = [];
      for (const [propName, prop] of Object.entries(databaseProperties) as [string, any][]) {
        const pType = prop?.type;
        const pId = prop?.id || propName;
        const lowerName = propName.toLowerCase();

        if (pType === 'title') {
          initialMappings.push({
            notionPropertyId: pId,
            notionPropertyName: propName,
            notionPropertyType: 'title',
            source: 'page_title',
            showInPopup: true,
            required: true,
          });
        } else if (pType === 'url' || lowerName === 'url' || lowerName === 'link') {
          initialMappings.push({
            notionPropertyId: pId,
            notionPropertyName: propName,
            notionPropertyType: pType || 'url',
            source: 'page_url',
            showInPopup: true,
          });
        } else if (pType === 'multi_select' || pType === 'select') {
          initialMappings.push({
            notionPropertyId: pId,
            notionPropertyName: propName,
            notionPropertyType: pType,
            options: prop?.options || prop?.multi_select?.options || prop?.select?.options || undefined,
            source: 'manual',
            showInPopup: true,
          });
        }
      }
      setMappings(initialMappings);
    } else {
      setMappings([
        {
          notionPropertyId: 'title',
          notionPropertyName: 'Name',
          notionPropertyType: 'title',
          source: 'page_title',
          showInPopup: true,
          required: true,
        },
        {
          notionPropertyId: 'url',
          notionPropertyName: 'URL',
          notionPropertyType: 'url',
          source: 'page_url',
          showInPopup: true,
        },
      ]);
    }
  };

  const handleDeleteFormAction = async () => {
    setIsMoreMenuOpen(false);
    if (!initialForm) return;
    if (window.confirm(`Are you sure you want to delete form "${formName}"?`)) {
      if (onDeleteForm) {
        onDeleteForm(initialForm.id);
      } else {
        await deleteForm(initialForm.id);
        onCancel();
      }
    }
  };

  const handleSelectLocation = (dest: NotionDestination) => {
    setSelectedDestination(dest);
    setFormName(`Save to ${dest.title}`);
    setStep('configure_form');
  };

  const handleRemoveField = (propId: string) => {
    setMappings((prev) => prev.filter((m) => m.notionPropertyId !== propId));
  };

  const handleAddFieldFromDatabase = (propName: string, prop: any) => {
    const propId = prop?.id || propName;
    if (mappings.some((m) => m.notionPropertyId === propId)) return;

    let defaultSource: PropertyDataSource = 'manual';
    const lowerName = propName.toLowerCase();
    const pType = prop?.type || 'rich_text';

    if (pType === 'title') defaultSource = 'page_title';
    else if (pType === 'url' || lowerName.includes('url') || lowerName.includes('link')) defaultSource = 'page_url';
    else if (lowerName.includes('desc') || lowerName.includes('resumo') || lowerName.includes('caption') || lowerName.includes('legenda')) defaultSource = 'page_description';
    else if (pType === 'date' || lowerName.includes('data') || lowerName.includes('date')) defaultSource = 'page_date';
    else if (lowerName.includes('author') || lowerName.includes('autor')) defaultSource = 'page_author';

    const opts = prop?.options || prop?.multi_select?.options || prop?.select?.options || [];
    const newMapping: PropertyFieldMapping = {
      notionPropertyId: propId,
      options: opts.length > 0 ? opts : undefined,
      notionPropertyName: propName,
      notionPropertyType: pType,
      source: defaultSource,
      showInPopup: true,
      required: pType === 'title',
    };

    setMappings((prev) => [...prev, newMapping]);
    setIsAddFieldOpen(false);
    setPropertySearchQuery('');
  };

  const handleSelectSource = (propId: string, source: PropertyDataSource) => {
    setMappings((prev) =>
      prev.map((m) => (m.notionPropertyId === propId ? { ...m, source } : m))
    );
    setActiveSourceMenuId(null);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDestination) return;

    setSubmitting(true);
    try {
      const newForm: FormConfig = {
        id: initialForm ? initialForm.id : crypto.randomUUID(),
        name: formName.trim() || 'Save Links',
        icon: formIcon,
        destinationType: selectedDestination.type,
        databaseId: selectedDestination.id,
        databaseTitle: selectedDestination.title,
        destinationUrl: selectedDestination.url,
        destinationPath: selectedDestination.path || initialForm?.destinationPath,
        showFullPath,
        pageSaveMode: selectedDestination.type === 'page' ? pageSaveMode : undefined,
        detectExisting,
        clipContent: clipAction === 'article',
        mappings,
        createdAt: initialForm ? initialForm.createdAt : Date.now(),
      };

      await saveForm(newForm);
      onFormCreated(newForm);
    } catch (err: any) {
      alert(`Error saving form: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const renderPropertyIcon = (propType: string) => {
    switch (propType) {
      case 'title':
        return <Type className="w-3.5 h-3.5 text-gray-500" />;
      case 'multi_select':
      case 'select':
        return <Tag className="w-3.5 h-3.5 text-blue-500" />;
      case 'url':
        return <Link2 className="w-3.5 h-3.5 text-purple-500" />;
      case 'rich_text':
        return <AlignLeft className="w-3.5 h-3.5 text-emerald-500" />;
      case 'date':
        return <Calendar className="w-3.5 h-3.5 text-amber-500" />;
      case 'number':
        return <Hash className="w-3.5 h-3.5 text-gray-500" />;
      case 'files':
        return <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />;
      default:
        return <FileSpreadsheet className="w-3.5 h-3.5 text-gray-400" />;
    }
  };

  const renderSourceIcon = (source: PropertyDataSource) => {
    const opt = SOURCE_OPTIONS.find((s) => s.source === source);
    if (!opt) return <FileText className="w-3 h-3 text-gray-400" />;
    const IconComponent = opt.icon;
    return <IconComponent className="w-3 h-3 text-gray-500" />;
  };

  const getSourceLabel = (source: PropertyDataSource) => {
    const opt = SOURCE_OPTIONS.find((s) => s.source === source);
    return opt?.label || 'Manual';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-2 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <p className="text-xs">Loading Notion data...</p>
      </div>
    );
  }

  if (error || destinations.length === 0) {
    return (
      <div className="p-4 space-y-3 text-xs">
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-md">
          <p className="font-semibold mb-1">No locations found in Notion!</p>
          <p className="text-[11px] leading-relaxed">
            Make sure you have shared at least one Database or Page with your Notion integration.
            <br />
            In Notion, open your Page or Database &gt; click <b>(...)</b> &gt; <b>Connections</b> &gt; add your integration.
          </p>
        </div>
        <button
          onClick={onCancel}
          className="w-full py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md font-medium text-xs cursor-pointer"
        >
          Back
        </button>
      </div>
    );
  }

  // SECONDARY STEP: Select a Save Location
  if (step === 'select_location') {
    const filteredDestinations = destinations.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.path && item.path.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;
      if (filterType === 'database') return item.type === 'database';
      if (filterType === 'page') return item.type === 'page';
      return true;
    });

    const databaseItems = filteredDestinations.filter((d) => d.type === 'database');
    const pageItems = filteredDestinations.filter((d) => d.type === 'page');

    const isSearching = searchQuery.trim().length > 0;
    const visibleDatabases = isSearching
      ? databaseItems
      : isDatabasesCollapsed
      ? []
      : expandAllDatabases
      ? databaseItems
      : databaseItems.slice(0, 6);

    const visiblePages = isSearching
      ? pageItems
      : isPagesCollapsed
      ? []
      : expandAllPages
      ? pageItems
      : pageItems.slice(0, 6);

    return (
      <div className="p-3.5 space-y-3 text-xs text-gray-800 bg-[#f8f9fa] flex flex-col h-full min-h-[440px]">
        {/* Header with back arrow */}
        <div className="flex items-center justify-between pb-2 border-b border-gray-200">
          <button
            onClick={() => setStep('configure_form')}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-600 transition-colors cursor-pointer"
            title="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="font-semibold text-sm text-gray-900">
            Select a Save Location
          </div>
          <div className="w-7" />
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search databases and pages..."
            className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            autoFocus
          />
          {searchingServer && (
            <Loader2 className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-blue-500 animate-spin" />
          )}
        </div>

        {/* Filter: Viewing */}
        <div className="flex items-center justify-between px-1 text-[11px] text-gray-500">
          <span>Viewing</span>
          <div className="relative">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as FilterType)}
              className="bg-blue-50 text-blue-700 font-medium rounded-md px-2 py-1 border border-blue-200 text-[11px] appearance-none pr-6 cursor-pointer focus:outline-none"
            >
              <option value="all">Databases & Pages</option>
              <option value="database">Databases only</option>
              <option value="page">Pages only</option>
            </select>
            <ChevronDown className="w-3 h-3 absolute right-1.5 top-2 text-blue-700 pointer-events-none" />
          </div>
        </div>

        {/* Results List */}
        <div className="space-y-3 flex-1 overflow-y-auto pr-1">
          {filteredDestinations.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-xs">
              No databases or pages found for "{searchQuery}".
            </div>
          ) : (
            <>
              {databaseItems.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-1">
                    <button
                      type="button"
                      onClick={() => !isSearching && setIsDatabasesCollapsed((prev) => !prev)}
                      className={`flex items-center gap-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors ${isSearching ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      <span>Databases ({databaseItems.length})</span>
                      {!isSearching && (
                        isDatabasesCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                      )}
                    </button>
                    {!isSearching && databaseItems.length > 6 && !isDatabasesCollapsed && (
                      <button
                        type="button"
                        onClick={() => setExpandAllDatabases((prev) => !prev)}
                        className="text-[10px] font-medium text-blue-600 hover:underline cursor-pointer"
                      >
                        {expandAllDatabases ? 'Collapse' : `View all (${databaseItems.length})`}
                      </button>
                    )}
                  </div>

                  {!isDatabasesCollapsed && (
                    <div className="space-y-1">
                      {visibleDatabases.map((db) => (
                        <div
                          key={db.id}
                          className="w-full flex items-center justify-between gap-2 p-2 rounded-lg border border-transparent hover:border-gray-200 hover:bg-white transition-all text-left group"
                        >
                          <button
                            type="button"
                            onClick={() => handleSelectLocation(db)}
                            className="flex items-center gap-2.5 truncate flex-1 min-w-0 cursor-pointer text-left"
                          >
                            <span className="text-base shrink-0 w-7 h-7 flex items-center justify-center bg-gray-100 rounded-md group-hover:bg-blue-50 transition-colors">
                              {db.icon && (db.icon.startsWith('http://') || db.icon.startsWith('https://')) ? (
                                <img src={db.icon} alt="" className="w-4 h-4 object-contain rounded" />
                              ) : (
                                <span>{db.icon || '📁'}</span>
                              )}
                            </span>
                            <div className="truncate flex-1 min-w-0">
                              <div className="font-semibold text-gray-900 truncate text-xs group-hover:text-blue-600 transition-colors">
                                {db.title}
                              </div>
                              <div className="text-[10px] text-gray-400 truncate">
                                {db.path || 'Workspace'}
                              </div>
                            </div>
                          </button>

                          <a
                            href={db.url || `https://www.notion.so/${db.id.replace(/-/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Open in Notion in new tab"
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer shrink-0"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ))}

                      {!isSearching && databaseItems.length > 6 && !expandAllDatabases && (
                        <button
                          type="button"
                          onClick={() => setExpandAllDatabases(true)}
                          className="w-full py-1.5 text-center text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50/70 rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1 border border-dashed border-blue-200 mt-1"
                        >
                          <span>Show more ({databaseItems.length - 6} remaining)</span>
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {pageItems.length > 0 && (
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between px-1">
                    <button
                      type="button"
                      onClick={() => !isSearching && setIsPagesCollapsed((prev) => !prev)}
                      className={`flex items-center gap-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors ${isSearching ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      <span>Pages ({pageItems.length})</span>
                      {!isSearching && (
                        isPagesCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                      )}
                    </button>
                    {!isSearching && pageItems.length > 6 && !isPagesCollapsed && (
                      <button
                        type="button"
                        onClick={() => setExpandAllPages((prev) => !prev)}
                        className="text-[10px] font-medium text-blue-600 hover:underline cursor-pointer"
                      >
                        {expandAllPages ? 'Collapse' : `View all (${pageItems.length})`}
                      </button>
                    )}
                  </div>

                  {!isPagesCollapsed && (
                    <div className="space-y-1">
                      {visiblePages.map((pg) => (
                        <div
                          key={pg.id}
                          className="w-full flex items-center justify-between gap-2 p-2 rounded-lg border border-transparent hover:border-gray-200 hover:bg-white transition-all text-left group"
                        >
                          <button
                            type="button"
                            onClick={() => handleSelectLocation(pg)}
                            className="flex items-center gap-2.5 truncate flex-1 min-w-0 cursor-pointer text-left"
                          >
                            <span className="text-base shrink-0 w-7 h-7 flex items-center justify-center bg-gray-100 rounded-md group-hover:bg-blue-50 transition-colors">
                              {pg.icon && (pg.icon.startsWith('http://') || pg.icon.startsWith('https://')) ? (
                                <img src={pg.icon} alt="" className="w-4 h-4 object-contain rounded" />
                              ) : (
                                <span>{pg.icon || '📄'}</span>
                              )}
                            </span>
                            <div className="truncate flex-1 min-w-0">
                              <div className="font-semibold text-gray-900 truncate text-xs group-hover:text-blue-600 transition-colors">
                                {pg.title}
                              </div>
                              <div className="text-[10px] text-gray-400 truncate">
                                {pg.path || 'Workspace'}
                              </div>
                            </div>
                          </button>

                          <a
                            href={pg.url || `https://www.notion.so/${pg.id.replace(/-/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Open in Notion in new tab"
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer shrink-0"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ))}

                      {!isSearching && pageItems.length > 6 && !expandAllPages && (
                        <button
                          type="button"
                          onClick={() => setExpandAllPages(true)}
                          className="w-full py-1.5 text-center text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50/70 rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1 border border-dashed border-blue-200 mt-1"
                        >
                          <span>Show more ({pageItems.length - 6} remaining)</span>
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // MAIN VIEW: Create / Edit Form
  const visibleFields = showAllFields ? mappings : mappings.slice(0, 2);
  const hiddenFieldsCount = Math.max(0, mappings.length - 2);

  return (
    <div className="p-3.5 space-y-3 text-xs text-gray-800 bg-[#f8f9fa]">
      {/* Header */}
      <div className="flex items-center justify-between pb-1">
        <button
          type="button"
          onClick={onCancel}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-600 transition-colors cursor-pointer"
          title="Back"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
        <h1 className="font-bold text-sm text-gray-900 tracking-tight">{initialForm ? 'Edit Form' : 'Create Form'}</h1>
        
        {/* Header More Menu (...) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
            title="More Form Options"
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-600 transition-colors cursor-pointer"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {isMoreMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40 bg-transparent"
                onClick={() => setIsMoreMenuOpen(false)}
              />
              <div className="absolute right-0 top-8 z-50 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 w-52 space-y-0.5 text-xs animate-fadeIn">
                <button
                  type="button"
                  onClick={handleDuplicateForm}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-gray-700 hover:bg-gray-50 hover:text-blue-600 cursor-pointer transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-gray-500" />
                  <span>Duplicate Form</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetFields}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-gray-700 hover:bg-gray-50 hover:text-blue-600 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
                  <span>Reset Default Fields</span>
                </button>
                {initialForm && (
                  <>
                    <div className="border-t border-gray-100 my-1" />
                    <button
                      type="button"
                      onClick={handleDeleteFormAction}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-red-600 hover:bg-red-50 cursor-pointer transition-colors font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      <span>Delete Form</span>
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <form onSubmit={handleSaveForm} className="space-y-3">
        {/* SECTION 1: Form Config */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-gray-500 tracking-wide uppercase px-0.5">
            Form Config
          </div>

          <div className="bg-white rounded-xl border border-gray-200/90 shadow-2xs p-3 space-y-3">
            {/* Row 1: Icon + Form Title */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="w-10 h-10 rounded-lg border border-red-100 bg-red-50 flex items-center justify-center text-xl hover:bg-red-100/80 transition-colors cursor-pointer shadow-2xs"
                >
                  {formIcon}
                </button>
                {showEmojiPicker && (
                  <div className="absolute top-12 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-2 grid grid-cols-4 gap-1.5 w-40">
                    {EMOJI_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setFormIcon(emoji);
                          setShowEmojiPicker(false);
                        }}
                        className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded text-base cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Save Links"
                className="flex-1 px-3 py-2 bg-gray-50/70 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Row 2: Save Location */}
            <div className="flex items-center justify-between pt-1">
              <span className="font-semibold text-gray-700 text-xs">Save Location</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setStep('select_location')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-medium text-[11px] transition-colors cursor-pointer max-w-[190px]"
                >
                  <span className="text-xs">{selectedDestination?.icon || '📁'}</span>
                  <span className="truncate">{selectedDestination?.title || 'Select location'}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                </button>
                {selectedDestination && (
                  <a
                    href={selectedDestination.url || `https://www.notion.so/${selectedDestination.id.replace(/-/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Open this location in Notion"
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded-md transition-colors cursor-pointer shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Subpage vs Append Mode for regular pages */}
            {selectedDestination?.type === 'page' && (
              <div className="p-2 bg-blue-50/50 border border-blue-100 rounded-lg flex items-center justify-between text-[11px]">
                <span className="font-medium text-blue-900">Save as:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPageSaveMode('subpage')}
                    className={`px-2 py-0.5 rounded font-medium cursor-pointer ${
                      pageSaveMode === 'subpage' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'
                    }`}
                  >
                    Sub-page
                  </button>
                  <button
                    type="button"
                    onClick={() => setPageSaveMode('append_block')}
                    className={`px-2 py-0.5 rounded font-medium cursor-pointer ${
                      pageSaveMode === 'append_block' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'
                    }`}
                  >
                    Append block
                  </button>
                </div>
              </div>
            )}

            {/* Row 3: Detect existing pages */}
            <div className="flex items-center justify-between pt-1">
              <span className="font-semibold text-gray-700 text-xs">Detect existing pages</span>
              <button
                type="button"
                onClick={() => setDetectExisting(!detectExisting)}
                className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer ${
                  detectExisting ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${
                    detectExisting ? 'left-4.5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Row 3b: Show folder path */}
            <div className="flex items-center justify-between pt-1">
              <div className="pr-2">
                <span className="font-semibold text-gray-700 text-xs">Show folder path</span>
                <div className="text-[10px] text-gray-400 truncate max-w-[210px]">
                  {selectedDestination?.path ? selectedDestination.path : 'Shows the folder/database path in the form list'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFullPath(!showFullPath)}
                className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer shrink-0 ${
                  showFullPath ? 'bg-blue-600' : 'bg-gray-300'
                }`}
                title={showFullPath ? 'Full path enabled' : 'Full path disabled'}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${
                    showFullPath ? 'left-4.5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Row 4: Clip Action */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1 font-semibold text-gray-700 text-xs">
                <span>Clip Action</span>
                <span className="text-[10px] text-gray-400">ⓘ</span>
              </div>

              {/* Segmented Pill Control */}
              <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200/80">
                <button
                  type="button"
                  onClick={() => setClipAction('bookmark')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                    clipAction === 'bookmark'
                      ? 'bg-white text-gray-900 shadow-2xs'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Bookmark
                </button>
                <button
                  type="button"
                  onClick={() => setClipAction('article')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                    clipAction === 'article'
                      ? 'bg-white text-gray-900 shadow-2xs'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Save Webpage
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: Fields */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-gray-500 tracking-wide uppercase px-0.5">
            Fields
          </div>

          <div className="bg-white rounded-xl border border-gray-200/90 shadow-2xs overflow-visible">
            {/* List of Mapped Fields */}
            <div className="divide-y divide-gray-100">
              {visibleFields.length === 0 ? (
                <div className="p-3 text-center text-gray-400 text-xs">
                  No fields added. Click below to add properties.
                </div>
              ) : (
                visibleFields.map((mapping) => {
                  const fullIndex = mappings.findIndex((m) => m.notionPropertyId === mapping.notionPropertyId);
                  const isDragging = draggedIndex === fullIndex;
                  const isDragOver = dragOverIndex === fullIndex;

                  return (
                    <div
                      key={mapping.notionPropertyId}
                      draggable
                      onDragStart={(e) => {
                        setDraggedIndex(fullIndex);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (draggedIndex !== null && draggedIndex !== fullIndex) {
                          setDragOverIndex(fullIndex);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverIndex === fullIndex) setDragOverIndex(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedIndex !== null && draggedIndex !== fullIndex) {
                          moveField(draggedIndex, fullIndex);
                        }
                        setDraggedIndex(null);
                        setDragOverIndex(null);
                      }}
                      onDragEnd={() => {
                        setDraggedIndex(null);
                        setDragOverIndex(null);
                      }}
                      className={`flex items-center justify-between px-3 py-2.5 transition-all select-none ${
                        isDragging ? 'opacity-35 bg-blue-50/60' : 'hover:bg-gray-50/70'
                      } ${isDragOver ? 'border-t-2 border-blue-500 bg-blue-50/30' : ''}`}
                    >
                      {/* Left: Grip with quick arrows + Type + Property Name */}
                      <div className="flex items-center gap-2 truncate">
                        <div className="flex items-center gap-0.5 group/grip shrink-0">
                          <div
                            className="p-1 -ml-1 text-gray-400 hover:text-blue-600 rounded cursor-grab active:cursor-grabbing transition-colors"
                            title="Drag to reorder fields or use arrows"
                          >
                            <GripVertical className="w-3.5 h-3.5 shrink-0" />
                          </div>
                          <div className="flex flex-col -space-y-1 opacity-0 group-hover/grip:opacity-100 transition-opacity">
                            <button
                              type="button"
                              disabled={fullIndex === 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                moveField(fullIndex, fullIndex - 1);
                              }}
                              className="text-gray-400 hover:text-blue-600 disabled:opacity-0 p-0.5 rounded cursor-pointer"
                              title="Move up"
                            >
                              <ChevronUp className="w-2.5 h-2.5" />
                            </button>
                            <button
                              type="button"
                              disabled={fullIndex === mappings.length - 1}
                              onClick={(e) => {
                                e.stopPropagation();
                                moveField(fullIndex, fullIndex + 1);
                              }}
                              className="text-gray-400 hover:text-blue-600 disabled:opacity-0 p-0.5 rounded cursor-pointer"
                              title="Move down"
                            >
                              <ChevronDown className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>

                        <div className="shrink-0">{renderPropertyIcon(mapping.notionPropertyType)}</div>
                        <span className="font-semibold text-xs text-gray-800 truncate">
                          {mapping.notionPropertyName}
                          {mapping.required && <span className="text-gray-400 ml-0.5">*</span>}
                        </span>
                      </div>

                    {/* Right: Arrow + Source Pill */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-gray-300 text-xs">→</span>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveSourceMenuId(
                              activeSourceMenuId === mapping.notionPropertyId ? null : mapping.notionPropertyId
                            )
                          }
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 hover:bg-gray-200/80 text-gray-700 text-xs font-medium transition-colors cursor-pointer"
                        >
                          {renderSourceIcon(mapping.source)}
                          <span>{getSourceLabel(mapping.source)}</span>
                          {!mapping.required && (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveField(mapping.notionPropertyId);
                              }}
                              className="text-gray-400 hover:text-red-500 ml-0.5 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </span>
                          )}
                        </button>

                        {/* Source Selection Menu */}
                        {activeSourceMenuId === mapping.notionPropertyId && (
                          <div className="absolute right-0 top-8 z-50 bg-white border border-gray-200 rounded-lg shadow-xl py-1 w-48 space-y-0.5 text-xs">
                            <div className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                              Choose Source
                            </div>
                            {SOURCE_OPTIONS.map((opt) => {
                              const isSelected = mapping.source === opt.source;
                              const Icon = opt.icon;
                              return (
                                <button
                                  key={opt.source}
                                  type="button"
                                  onClick={() => handleSelectSource(mapping.notionPropertyId, opt.source)}
                                  className="w-full flex items-center justify-between px-2.5 py-1.5 text-left hover:bg-gray-50 cursor-pointer"
                                >
                                  <div className="flex items-center gap-2">
                                    <Icon className="w-3.5 h-3.5 text-gray-500" />
                                    <span className="text-xs text-gray-800">{opt.label}</span>
                                  </div>
                                  {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })
              )}
            </div>

            {/* Button + Add New Field */}
            <div className="border-t border-gray-100 p-2 relative">
              <button
                type="button"
                onClick={() => setIsAddFieldOpen(!isAddFieldOpen)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-gray-600 hover:bg-gray-50 text-xs font-semibold cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-gray-500" />
                <span>Add New Field</span>
              </button>

              {/* Dropdown Menu "+ Add New Field" */}
              {isAddFieldOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40 bg-black/15 transition-opacity"
                    onClick={() => setIsAddFieldOpen(false)}
                  />

                  <div className="absolute left-2 right-2 bottom-full mb-1.5 z-50 bg-white border border-gray-200 rounded-xl shadow-2xl p-2.5 space-y-2 max-h-60 overflow-y-auto animate-fadeIn">
                    <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                      <span className="font-bold text-xs text-gray-800">Add Property</span>
                      <button
                        type="button"
                        onClick={() => setIsAddFieldOpen(false)}
                        className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                        title="Close"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-gray-400" />
                      <input
                        type="text"
                        value={propertySearchQuery}
                        onChange={(e) => setPropertySearchQuery(e.target.value)}
                        placeholder="Search for a property..."
                        className="w-full pl-8 pr-2 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        autoFocus
                      />
                    </div>

                    {/* Database Properties */}
                    <div className="space-y-1">
                      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1">
                        Database Properties
                      </div>

                      <div className="space-y-0.5">
                        {Object.entries(databaseProperties).length === 0 ? (
                          <div className="py-2.5 text-center text-gray-400 text-xs">
                            {selectedDestination?.type === 'page'
                              ? 'Regular pages do not have custom properties.'
                              : 'No additional properties found in this database.'}
                          </div>
                        ) : (
                          Object.entries(databaseProperties)
                            .filter(([name]) =>
                              name.toLowerCase().includes(propertySearchQuery.toLowerCase())
                            )
                            .map(([propName, prop]: any) => {
                              const propId = prop?.id || propName;
                              const isAlreadyAdded = mappings.some(
                                (m) => m.notionPropertyId === propId
                              );

                              return (
                                <button
                                  key={propId}
                                  type="button"
                                  disabled={isAlreadyAdded}
                                  onClick={() => handleAddFieldFromDatabase(propName, prop)}
                                  className={`w-full flex items-center justify-between p-1.5 rounded-md text-xs text-left cursor-pointer transition-colors ${
                                    isAlreadyAdded
                                      ? 'opacity-40 cursor-not-allowed bg-transparent'
                                      : 'hover:bg-blue-50 text-gray-800'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    {renderPropertyIcon(prop?.type || 'rich_text')}
                                    <span className="font-medium truncate">{propName}</span>
                                  </div>
                                  <span className="text-[10px] text-gray-400">
                                    {isAlreadyAdded ? 'Already Added' : `+ Add`}
                                  </span>
                                </button>
                              );
                            })
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Expand / Collapse Extra Fields */}
              {hiddenFieldsCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllFields(!showAllFields)}
                  className="w-full flex items-center gap-1.5 px-2 py-1 text-gray-500 hover:text-gray-800 text-[11px] font-medium cursor-pointer transition-colors"
                >
                  {showAllFields ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" />
                      <span>Hide {hiddenFieldsCount} fields</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" />
                      <span>{hiddenFieldsCount} more fields</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{initialForm ? 'Saving Changes...' : 'Saving Form...'}</span>
              </>
            ) : (
              <span>{initialForm ? 'Save Changes' : 'Save Form'}</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

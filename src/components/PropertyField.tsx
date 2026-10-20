import React, { useState, useMemo } from 'react';
import {
  Check,
  ChevronDown,
  Plus,
  X,
  Calendar,
  Hash,
  Tag,
  AlignLeft,
  Pencil,
  Trash2,
  Search,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import type { PropertyFieldMapping, NotionPropertyOption } from '../types';
import { getNotionColor, NOTION_COLORS } from '../utils/notionColors';
import { updateDatabasePropertyOptions, getDatabaseSchema } from '../services/notion';

interface PropertyFieldProps {
  mapping: PropertyFieldMapping;
  value: any;
  onChange: (val: any) => void;
  apiKey?: string;
  databaseId?: string;
  onOptionsUpdate?: (propertyId: string, newOptions: NotionPropertyOption[]) => void;
}

export const PropertyField: React.FC<PropertyFieldProps> = ({
  mapping,
  value,
  onChange,
  apiKey,
  databaseId,
  onOptionsUpdate,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [options, setOptions] = useState<NotionPropertyOption[]>(mapping.options || []);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // State for Tag Editing (Name and Color)
  const [editingOption, setEditingOption] = useState<NotionPropertyOption | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('default');

  const type = mapping.notionPropertyType;

  // Sync local options if mapping changes
  React.useEffect(() => {
    if (mapping.options && mapping.options.length > 0) {
      setOptions(mapping.options);
    }
  }, [mapping.options]);

  // Fetches updated options directly from Notion API if apiKey and databaseId exist
  React.useEffect(() => {
    let isMounted = true;
    async function fetchLatestOptions() {
      if (!apiKey || !databaseId || (type !== 'select' && type !== 'multi_select')) {
        return;
      }
      try {
        setLoadingOptions(true);
        const schema = await getDatabaseSchema(apiKey, databaseId);
        const props = schema.properties || {};

        let foundProp = props[mapping.notionPropertyName];
        if (!foundProp) {
          foundProp = Object.values(props).find(
            (p) =>
              p.id === mapping.notionPropertyId ||
              p.name?.toLowerCase() === mapping.notionPropertyName.toLowerCase()
          );
        }

        if (foundProp && isMounted) {
          const remoteOptions =
            foundProp.options ||
            foundProp.multi_select?.options ||
            foundProp.select?.options ||
            [];
          if (remoteOptions.length > 0) {
            setOptions(remoteOptions);
            if (onOptionsUpdate) {
              onOptionsUpdate(mapping.notionPropertyId, remoteOptions);
            }
          }
        }
      } catch (err) {
        console.warn('Error loading options from Notion:', err);
      } finally {
        if (isMounted) setLoadingOptions(false);
      }
    }
    fetchLatestOptions();
    return () => {
      isMounted = false;
    };
  }, [apiKey, databaseId, mapping.notionPropertyId, mapping.notionPropertyName, type]);

  // Filters options in real-time
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    return options.filter((opt) =>
      opt.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
    );
  }, [options, searchQuery]);

  // Checks if typed search matches existing option exactly
  const exactMatchExists = useMemo(() => {
    return options.some(
      (opt) => opt.name.toLowerCase() === searchQuery.trim().toLowerCase()
    );
  }, [options, searchQuery]);

  // Syncs with Notion API
  const syncWithNotion = async (updatedOptions: NotionPropertyOption[]) => {
    setOptions(updatedOptions);
    if (onOptionsUpdate) {
      onOptionsUpdate(mapping.notionPropertyId, updatedOptions);
    }

    if (apiKey && databaseId && (type === 'select' || type === 'multi_select')) {
      try {
        await updateDatabasePropertyOptions(
          apiKey,
          databaseId,
          mapping.notionPropertyName,
          type,
          updatedOptions
        );
      } catch (err) {
        console.warn('Failed to sync options with Notion database:', err);
      }
    }
  };

  // Create new tag
  const handleCreateTag = async (tagName: string, tagColor = 'default') => {
    const cleanName = tagName.trim();
    if (!cleanName) return;

    const newOpt: NotionPropertyOption = {
      id: crypto.randomUUID(),
      name: cleanName,
      color: tagColor,
    };

    const nextOptions = [...options, newOpt];
    await syncWithNotion(nextOptions);

    if (type === 'multi_select') {
      const currentArr = Array.isArray(value) ? value : value ? [String(value)] : [];
      if (!currentArr.includes(cleanName)) {
        onChange([...currentArr, cleanName]);
      }
    } else if (type === 'select') {
      onChange(cleanName);
    }

    setSearchQuery('');
  };

  // Delete existing option
  const handleDeleteOption = async (e: React.MouseEvent, optToDelete: NotionPropertyOption) => {
    e.stopPropagation();
    const nextOptions = options.filter((o) => o.name !== optToDelete.name);
    await syncWithNotion(nextOptions);

    if (type === 'multi_select') {
      const currentArr = Array.isArray(value) ? value : [];
      onChange(currentArr.filter((t: string) => t !== optToDelete.name));
    } else if (type === 'select' && value === optToDelete.name) {
      onChange('');
    }
  };

  // Start editing an option
  const handleStartEdit = (e: React.MouseEvent, opt: NotionPropertyOption) => {
    e.stopPropagation();
    setEditingOption(opt);
    setEditName(opt.name);
    setEditColor(opt.color || 'default');
  };

  // Save edit
  const handleSaveEdit = async () => {
    if (!editingOption || !editName.trim()) return;

    const oldName = editingOption.name;
    const newName = editName.trim();

    const nextOptions = options.map((opt) =>
      opt.name === oldName ? { ...opt, name: newName, color: editColor } : opt
    );

    await syncWithNotion(nextOptions);

    if (type === 'multi_select') {
      const currentArr = Array.isArray(value) ? value : [];
      onChange(currentArr.map((t: string) => (t === oldName ? newName : t)));
    } else if (type === 'select' && value === oldName) {
      onChange(newName);
    }

    setEditingOption(null);
  };

  // 1. SELECT (Single choice with search, create and edit)
  if (type === 'select') {
    const selectedOption = options.find((opt) => opt.name === value);
    const colorStyle = selectedOption ? getNotionColor(selectedOption.color) : getNotionColor('default');

    return (
      <div className="space-y-1">
        <label className="block text-[11px] font-semibold text-gray-700 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Tag className="w-3 h-3 text-gray-400" />
            {mapping.notionPropertyName}
          </span>
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-[10px] text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              Clear
            </button>
          )}
        </label>

        <div className="relative">
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 border border-gray-300 rounded-md bg-white text-xs hover:border-gray-400 transition-colors cursor-pointer text-left"
          >
            {value ? (
              <span
                className="px-2 py-0.5 rounded text-[11px] font-medium"
                style={{
                  backgroundColor: colorStyle.bg,
                  color: colorStyle.text,
                }}
              >
                {value}
              </span>
            ) : (
              <span className="text-gray-400 text-[11px]">Select option...</span>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {isDropdownOpen && (
            <div className="absolute z-40 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 max-h-56 overflow-y-auto space-y-2">
              {/* Search input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchQuery.trim() && !exactMatchExists) {
                      e.preventDefault();
                      handleCreateTag(searchQuery);
                    }
                  }}
                  placeholder="Search or create option..."
                  className="w-full pl-8 pr-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              {/* Create option button */}
              {searchQuery.trim() && !exactMatchExists && (
                <button
                  type="button"
                  onClick={() => handleCreateTag(searchQuery)}
                  className="w-full flex items-center gap-2 p-1.5 rounded-md hover:bg-blue-50 text-blue-700 text-xs font-medium cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    Create option <b>"{searchQuery.trim()}"</b>
                  </span>
                </button>
              )}

              {/* Filtered options list */}
              <div className="space-y-0.5 max-h-36 overflow-y-auto">
                {loadingOptions && options.length === 0 ? (
                  <div className="p-3 text-center text-gray-400 text-[11px] flex items-center justify-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                    <span>Loading options...</span>
                  </div>
                ) : filteredOptions.length === 0 && !searchQuery.trim() ? (
                  <div className="p-2 text-center text-gray-400 text-[11px]">
                    No options registered
                  </div>
                ) : (
                  filteredOptions.map((opt) => {
                    const style = getNotionColor(opt.color);
                    const isSelected = value === opt.name;

                    return (
                      <div
                        key={opt.id || opt.name}
                        onClick={() => {
                          onChange(opt.name);
                          setIsDropdownOpen(false);
                        }}
                        className={`group w-full flex items-center justify-between p-1.5 rounded text-left text-xs hover:bg-gray-50 cursor-pointer ${
                          isSelected ? 'bg-blue-50/50 font-medium' : ''
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span
                            className="px-2 py-0.5 rounded text-[11px] font-medium"
                            style={{ backgroundColor: style.bg, color: style.text }}
                          >
                            {opt.name}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                        </div>

                        {/* Actions: Edit and Delete */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => handleStartEdit(e, opt)}
                            title="Edit option"
                            className="p-1 hover:bg-gray-200 text-gray-500 rounded cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteOption(e, opt)}
                            title="Delete option"
                            className="p-1 hover:bg-red-100 text-red-500 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. MULTI-SELECT (Multiple Tags with live search, create, color edit, and delete)
  if (type === 'multi_select') {
    const selectedValues: string[] = Array.isArray(value) ? value : value ? [String(value)] : [];

    const handleToggleTag = (tagName: string) => {
      if (selectedValues.includes(tagName)) {
        onChange(selectedValues.filter((t) => t !== tagName));
      } else {
        onChange([...selectedValues, tagName]);
      }
    };

    return (
      <div className="space-y-1.5">
        <label className="block text-[11px] font-semibold text-gray-700 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Tag className="w-3 h-3 text-gray-400" />
            {mapping.notionPropertyName}
          </span>
          {selectedValues.length > 0 && (
            <span className="text-[10px] text-gray-400">
              {selectedValues.length} selected
            </span>
          )}
        </label>

        {/* Selected tags */}
        <div className="p-1.5 border border-gray-300 rounded-md bg-white min-h-[34px] flex flex-wrap gap-1.5 items-center">
          {selectedValues.map((tag) => {
            const opt = options.find((o) => o.name === tag);
            const style = getNotionColor(opt?.color);

            return (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors"
                style={{ backgroundColor: style.bg, color: style.text }}
              >
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => handleToggleTag(tag)}
                  className="hover:opacity-75 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}

          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="text-[11px] text-blue-600 hover:text-blue-700 font-medium px-1.5 py-0.5 rounded hover:bg-blue-50 cursor-pointer flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            <span>Add tag</span>
          </button>
        </div>

        {/* Dropdown with live search and editing */}
        {isDropdownOpen && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2.5 space-y-2.5 mt-1 z-40">
            {/* Inline tag edit modal */}
            {editingOption ? (
              <div className="p-2 bg-gray-50 border border-gray-200 rounded-md space-y-2">
                <div className="text-[11px] font-semibold text-gray-800 flex items-center justify-between">
                  <span>Edit Tag</span>
                  <button
                    type="button"
                    onClick={() => setEditingOption(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  placeholder="Tag name"
                />

                {/* Notion Color Picker */}
                <div>
                  <div className="text-[10px] text-gray-500 mb-1">Notion Color:</div>
                  <div className="flex flex-wrap gap-1">
                    {Object.keys(NOTION_COLORS).map((colorKey) => {
                      const color = NOTION_COLORS[colorKey]!;
                      const isSelected = editColor === colorKey;

                      return (
                        <button
                          key={colorKey}
                          type="button"
                          onClick={() => setEditColor(colorKey)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium border cursor-pointer ${
                            isSelected ? 'ring-2 ring-blue-500 font-bold' : ''
                          }`}
                          style={{
                            backgroundColor: color.bg,
                            color: color.text,
                            borderColor: color.border,
                          }}
                        >
                          {colorKey}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditingOption(null)}
                    className="px-2 py-0.5 rounded bg-gray-200 text-gray-700 text-[11px] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="px-2 py-0.5 rounded bg-blue-600 text-white text-[11px] font-medium cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Real-time search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchQuery.trim() && !exactMatchExists) {
                        e.preventDefault();
                        handleCreateTag(searchQuery);
                      }
                    }}
                    placeholder="Search or create new tag..."
                    className="w-full pl-8 pr-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                </div>

                {/* Option to create tag */}
                {searchQuery.trim() && !exactMatchExists && (
                  <button
                    type="button"
                    onClick={() => handleCreateTag(searchQuery)}
                    className="w-full flex items-center gap-2 p-1.5 rounded-md hover:bg-blue-50 text-blue-700 text-xs font-medium cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>
                      Create tag <b>"{searchQuery.trim()}"</b>
                    </span>
                  </button>
                )}

                {/* Filtered options list */}
                <div className="max-h-36 overflow-y-auto space-y-0.5">
                  {loadingOptions && options.length === 0 ? (
                    <div className="p-3 text-center text-gray-400 text-[11px] flex items-center justify-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                      <span>Loading tags...</span>
                    </div>
                  ) : filteredOptions.length === 0 && !searchQuery.trim() ? (
                    <div className="p-2 text-center text-gray-400 text-[11px]">
                      No tags registered
                    </div>
                  ) : (
                    filteredOptions.map((opt) => {
                      const style = getNotionColor(opt.color);
                      const isSelected = selectedValues.includes(opt.name);

                      return (
                        <div
                          key={opt.id || opt.name}
                          className="group w-full flex items-center justify-between p-1.5 rounded hover:bg-gray-50 text-xs cursor-pointer"
                          onClick={() => handleToggleTag(opt.name)}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span
                              className="px-2 py-0.5 rounded text-[11px] font-medium"
                              style={{ backgroundColor: style.bg, color: style.text }}
                            >
                              {opt.name}
                            </span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                          </div>

                          {/* Actions: Edit and Delete */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => handleStartEdit(e, opt)}
                              title="Edit tag"
                              className="p-1 hover:bg-gray-200 text-gray-500 rounded cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteOption(e, opt)}
                              title="Delete tag"
                              className="p-1 hover:bg-red-100 text-red-500 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="pt-1.5 border-t border-gray-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setSearchQuery('');
                    }}
                    className="text-[10px] text-gray-500 hover:text-gray-800 font-medium px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // 3. STATUS (with Notion Colors)
  if (type === 'status') {
    return (
      <div className="space-y-1">
        <label className="block text-[11px] font-semibold text-gray-700">
          {mapping.notionPropertyName}
        </label>
        <div className="relative">
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md bg-white text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
          >
            <option value="">(No status selected)</option>
            {options.map((opt) => (
              <option key={opt.id || opt.name} value={opt.name}>
                {opt.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  // 4. CHECKBOX (Toggle / Interactive switch)
  if (type === 'checkbox') {
    const isChecked = Boolean(value);

    return (
      <label className="flex items-center gap-2.5 py-1 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
        />
        <span className="text-[11px] font-semibold text-gray-700">
          {mapping.notionPropertyName}
        </span>
      </label>
    );
  }

  // 5. DATE (Native Datepicker)
  if (type === 'date') {
    return (
      <div className="space-y-1">
        <label className="block text-[11px] font-semibold text-gray-700 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3 text-gray-400" />
            {mapping.notionPropertyName}
          </span>
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-[10px] text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              Clear
            </button>
          )}
        </label>
        <input
          type="date"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white cursor-pointer"
        />
      </div>
    );
  }

  // 6. NUMBER
  if (type === 'number') {
    return (
      <div className="space-y-1">
        <label className="block text-[11px] font-semibold text-gray-700 flex items-center gap-1">
          <Hash className="w-3 h-3 text-gray-400" />
          {mapping.notionPropertyName}
        </label>
        <input
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="0"
          className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
        />
      </div>
    );
  }

  // 7. RICH TEXT / TEXT
  if (type === 'rich_text') {
    return (
      <div className="space-y-1">
        <label className="block text-[11px] font-semibold text-gray-700 flex items-center gap-1">
          <AlignLeft className="w-3 h-3 text-gray-400" />
          {mapping.notionPropertyName}
        </label>
        <textarea
          rows={2}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${mapping.notionPropertyName}...`}
          className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none"
        />
      </div>
    );
  }

  // 8. FALLBACK / URL / EMAIL / PHONE
  return (
    <div className="space-y-1">
      <label className="block text-[11px] font-semibold text-gray-700">
        {mapping.notionPropertyName}
      </label>
      <input
        type={type === 'url' ? 'url' : type === 'email' ? 'email' : 'text'}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Enter ${mapping.notionPropertyName}...`}
        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
      />
    </div>
  );
};

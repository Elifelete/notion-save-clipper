import React, { useState } from 'react';
import { Check, ChevronDown, Plus, X, Calendar, Hash, CheckSquare, Tag, AlignLeft, Globe } from 'lucide-react';
import type { PropertyFieldMapping, NotionPropertyOption } from '../types';
import { getNotionColor } from '../utils/notionColors';

interface PropertyFieldProps {
  mapping: PropertyFieldMapping;
  value: any;
  onChange: (val: any) => void;
}

export const PropertyField: React.FC<PropertyFieldProps> = ({
  mapping,
  value,
  onChange,
}) => {
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  const type = mapping.notionPropertyType;
  const options = mapping.options || [];

  // 1. SELECT (Escolha Única com Cor Notion)
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
              Limpar
            </button>
          )}
        </label>

        <div className="relative">
          <button
            type="button"
            onClick={() => setIsSelectOpen(!isSelectOpen)}
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
              <span className="text-gray-400 text-[11px]">Selecionar opção...</span>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {isSelectOpen && (
            <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1.5 max-h-48 overflow-y-auto space-y-1">
              {options.length === 0 ? (
                <div className="p-2 text-center text-gray-400 text-[11px]">
                  Nenhuma opção cadastrada na base
                </div>
              ) : (
                options.map((opt) => {
                  const style = getNotionColor(opt.color);
                  const isSelected = value === opt.name;
                  return (
                    <button
                      key={opt.id || opt.name}
                      type="button"
                      onClick={() => {
                        onChange(opt.name);
                        setIsSelectOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2 py-1 rounded text-left text-xs hover:bg-gray-50 cursor-pointer ${
                        isSelected ? 'bg-blue-50/50 font-medium' : ''
                      }`}
                    >
                      <span
                        className="px-2 py-0.5 rounded text-[11px] font-medium"
                        style={{ backgroundColor: style.bg, color: style.text }}
                      >
                        {opt.name}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. MULTI-SELECT (Múltiplas Tags com Cores Notion)
  if (type === 'multi_select') {
    const selectedValues: string[] = Array.isArray(value) ? value : value ? [String(value)] : [];

    const handleToggleTag = (tagName: string) => {
      if (selectedValues.includes(tagName)) {
        onChange(selectedValues.filter((t) => t !== tagName));
      } else {
        onChange([...selectedValues, tagName]);
      }
    };

    const handleAddNewTag = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && newTagInput.trim()) {
        e.preventDefault();
        const tag = newTagInput.trim();
        if (!selectedValues.includes(tag)) {
          onChange([...selectedValues, tag]);
        }
        setNewTagInput('');
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
              {selectedValues.length} selecionada(s)
            </span>
          )}
        </label>

        {/* Tags Selecionadas */}
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
            onClick={() => setIsSelectOpen(!isSelectOpen)}
            className="text-[11px] text-blue-600 hover:text-blue-700 font-medium px-1.5 py-0.5 rounded hover:bg-blue-50 cursor-pointer flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            <span>Adicionar tag</span>
          </button>
        </div>

        {/* Dropdown de Opções */}
        {isSelectOpen && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2 space-y-2 mt-1">
            <input
              type="text"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={handleAddNewTag}
              placeholder="Digite e tecle Enter para criar nova tag..."
              className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />

            <div className="max-h-36 overflow-y-auto space-y-1">
              {options.map((opt) => {
                const style = getNotionColor(opt.color);
                const isSelected = selectedValues.includes(opt.name);

                return (
                  <button
                    key={opt.id || opt.name}
                    type="button"
                    onClick={() => handleToggleTag(opt.name)}
                    className="w-full flex items-center justify-between p-1.5 rounded hover:bg-gray-50 text-left text-xs cursor-pointer"
                  >
                    <span
                      className="px-2 py-0.5 rounded text-[11px] font-medium"
                      style={{ backgroundColor: style.bg, color: style.text }}
                    >
                      {opt.name}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </button>
                );
              })}
            </div>

            <div className="pt-1 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSelectOpen(false)}
                className="text-[10px] text-gray-500 hover:text-gray-800 font-medium px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. STATUS (com Cores Notion)
  if (type === 'status') {
    const selectedOption = options.find((opt) => opt.name === value);
    const colorStyle = selectedOption ? getNotionColor(selectedOption.color) : getNotionColor('default');

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
            <option value="">(Nenhum status selecionado)</option>
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

  // 4. CHECKBOX (Toggle / Switch Interativo)
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

  // 5. DATE (Datepicker Nativo)
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
              Limpar
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

  // 7. RICH TEXT / TEXTO
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
          placeholder={`Preencher ${mapping.notionPropertyName}...`}
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
        placeholder={`Preencher ${mapping.notionPropertyName}...`}
        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
      />
    </div>
  );
};

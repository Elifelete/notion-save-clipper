import type { FormConfig } from '../types';

const STORAGE_KEYS = {
  API_KEY: 'notion_api_key',
  FORMS: 'notion_forms',
  DEFAULT_FORM_ID: 'notion_default_form_id',
};

// Helper universal para chrome.storage.local ou fallback para localStorage
async function getStorageItem<T>(key: string, defaultValue: T): Promise<T> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      const result = await chrome.storage.local.get([key]);
      return result[key] !== undefined ? (result[key] as T) : defaultValue;
    } catch (e) {
      console.warn(`Erro ao ler chrome.storage para chave ${key}`, e);
    }
  }

  try {
    const item = localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : defaultValue;
  } catch {
    return defaultValue;
  }
}

async function setStorageItem<T>(key: string, value: T): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      await chrome.storage.local.set({ [key]: value });
      return;
    } catch (e) {
      console.warn(`Erro ao gravar chrome.storage para chave ${key}`, e);
    }
  }

  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Erro ao gravar localStorage para chave ${key}`, e);
  }
}

export async function getApiKey(): Promise<string> {
  return getStorageItem<string>(STORAGE_KEYS.API_KEY, '');
}

export async function setApiKey(key: string): Promise<void> {
  return setStorageItem<string>(STORAGE_KEYS.API_KEY, key.trim());
}

export async function getForms(): Promise<FormConfig[]> {
  return getStorageItem<FormConfig[]>(STORAGE_KEYS.FORMS, []);
}

export async function saveForm(form: FormConfig): Promise<void> {
  const forms = await getForms();
  const index = forms.findIndex((f) => f.id === form.id);
  if (index >= 0) {
    forms[index] = form;
  } else {
    forms.push(form);
  }
  await setStorageItem(STORAGE_KEYS.FORMS, forms);

  const defaultId = await getDefaultFormId();
  if (!defaultId && forms.length > 0 && forms[0]) {
    await setDefaultFormId(forms[0].id);
  }
}

export async function deleteForm(formId: string): Promise<void> {
  const forms = await getForms();
  const filtered = forms.filter((f) => f.id !== formId);
  await setStorageItem(STORAGE_KEYS.FORMS, filtered);

  const defaultId = await getDefaultFormId();
  if (defaultId === formId) {
    await setDefaultFormId(filtered.length > 0 && filtered[0] ? filtered[0].id : '');
  }
}

export async function getDefaultFormId(): Promise<string> {
  return getStorageItem<string>(STORAGE_KEYS.DEFAULT_FORM_ID, '');
}

export async function setDefaultFormId(formId: string): Promise<void> {
  return setStorageItem<string>(STORAGE_KEYS.DEFAULT_FORM_ID, formId);
}

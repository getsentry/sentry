import React, {createContext, useContext, useEffect, useMemo, useState} from 'react';

const DEFAULT_PAGE_TITLE = 'Sentry';
const SEPARATOR = ' — ';

interface TitleEntry {
  id: string;
  noSuffix: boolean;
  order: number;
  text: string;
}

interface DocumentTitleManager {
  register: (id: string, text: string, order: number, noSuffix: boolean) => void;
  setPrefix: (id: string, prefix: string) => void;
  unregister: (id: string) => void;
}

const DocumentTitleContext = createContext<DocumentTitleManager>({
  register: () => {},
  setPrefix: () => {},
  unregister: () => {},
});

export const useDocumentTitleManager = () => useContext(DocumentTitleContext);

interface DocumentTitleManagerProps {
  children?: React.ReactNode;
  /**
   * Used as the title when no page registers one, and appended as the suffix
   * to page titles.
   */
  defaultTitle?: string;
}

export function DocumentTitleManager({
  children,
  defaultTitle = DEFAULT_PAGE_TITLE,
}: DocumentTitleManagerProps) {
  const [entries, setEntries] = useState<TitleEntry[]>([]);
  // Maps prefix id -> prefix string (e.g. "(3) ") prepended to the document title
  const [prefixes, setPrefixes] = useState<Record<string, string>>({});

  const [manager] = useState<DocumentTitleManager>(() => ({
    register: (id, text, order, noSuffix) => {
      setEntries(prev => {
        // update for same id
        if (prev.some(e => e.id === id)) {
          return prev.map(e => (e.id === id ? {...e, text, noSuffix} : e));
        }
        return [...prev, {id, text, noSuffix, order}];
      });
    },
    // Set a prefix by id; passing an empty string removes it
    setPrefix: (id, prefix) => {
      setPrefixes(prev => {
        if (!prefix) {
          // oxlint-disable-next-line react/todo
          const {[id]: _, ...rest} = prev;
          return rest;
        }
        if (prev[id] === prefix) {
          return prev;
        }
        return {...prev, [id]: prefix};
      });
    },
    unregister: id => {
      setEntries(prev => prev.filter(e => e.id !== id));
    },
  }));

  const fullTitle = useMemo(() => {
    const entry = entries
      .filter(e => e.text.trim() !== '')
      .sort((a, b) => b.order - a.order)
      .at(0);

    const parts = entry ? [entry.text] : [];

    if (!entry?.noSuffix) {
      parts.push(defaultTitle);
    }
    const base = [...new Set([...parts])].join(SEPARATOR);
    const prefix = Object.values(prefixes).filter(Boolean).join('');
    return `${prefix}${base}`;
  }, [entries, prefixes, defaultTitle]);

  // write to the DOM title
  useEffect(() => {
    if (fullTitle.length > 0) {
      document.title = fullTitle;
    }
  }, [fullTitle]);

  return (
    <DocumentTitleContext.Provider value={manager}>
      {children}
    </DocumentTitleContext.Provider>
  );
}

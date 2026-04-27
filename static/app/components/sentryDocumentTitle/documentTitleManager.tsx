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

export function DocumentTitleManager({children}: React.PropsWithChildren) {
  const [entries, setEntries] = useState<TitleEntry[]>([]);
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
    setPrefix: (id, prefix) => {
      setPrefixes(prev => {
        if (!prefix) {
          if (!(id in prev)) {
            return prev;
          }
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
      setPrefixes(prev => {
        if (!(id in prev)) {
          return prev;
        }
        const {[id]: _, ...rest} = prev;
        return rest;
      });
    },
  }));

  const fullTitle = useMemo(() => {
    const entry = entries
      .filter(e => e.text.trim() !== '')
      .sort((a, b) => b.order - a.order)
      .at(0);

    const parts = entry ? [entry.text] : [];

    if (!entry?.noSuffix) {
      parts.push(DEFAULT_PAGE_TITLE);
    }
    const base = [...new Set([...parts])].join(SEPARATOR);
    const prefix = Object.values(prefixes).filter(Boolean).join('');
    return `${prefix}${base}`;
  }, [entries, prefixes]);

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

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
  unregister: (id: string) => void;
}

const DocumentTitleContext = createContext<DocumentTitleManager>({
  register: () => {},
  unregister: () => {},
});

export const useDocumentTitleManager = () => useContext(DocumentTitleContext);

export function DocumentTitleManager({children}: React.PropsWithChildren) {
  const [entries, setEntries] = useState<TitleEntry[]>([]);

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
      parts.push(DEFAULT_PAGE_TITLE);
    }
    return [...new Set([...parts])].join(SEPARATOR);
  }, [entries]);

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

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const DEFAULT_PAGE_TITLE = 'Sentry';
const SEPARATOR = ' — ';

interface TitleEntry {
  id: string;
  noSuffix: boolean;
  // mount order for stable sorting
  order: number;
  text: string;
}

interface DocumentTitleManager {
  register: (id: string, text: string, noSuffix: boolean) => void;
  unregister: (id: string) => void;
}

const DocumentTitleContext = createContext<DocumentTitleManager>({
  register: () => {},
  unregister: () => {},
});

export const useDocumentTitleManager = () => useContext(DocumentTitleContext);

export function DocumentTitleManager({children}: React.PropsWithChildren) {
  const [entries, setEntries] = useState<TitleEntry[]>([]);
  const orderCounter = useRef(0);

  const [manager] = useState<DocumentTitleManager>(() => ({
    register: (id, text, noSuffix) => {
      setEntries(prev => {
        // update for same id
        if (prev.some(e => e.id === id)) {
          return prev.map(e => (e.id === id ? {...e, text, noSuffix} : e));
        }
        return [...prev, {id, text, noSuffix, order: orderCounter.current++}];
      });
    },
    unregister: id => {
      setEntries(prev => prev.filter(e => e.id !== id));
    },
  }));

  const fullTitle = useMemo(() => {
    const parts = entries
      .filter(e => e.text.trim() !== '')
      .sort((a, b) => a.order - b.order)
      .map(e => e.text)
      // effects run bottom-up so registration order needs to be reversed
      .reverse();

    if (parts.length === 0 || !entries.some(entry => !entry.noSuffix)) {
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

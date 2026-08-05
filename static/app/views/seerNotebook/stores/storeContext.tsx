import {createContext, useContext, type ReactNode} from 'react';

import type {NotebookStore} from 'sentry/views/seerNotebook/stores/notebookStore';

const NotebookStoreContext = createContext<NotebookStore | null>(null);

export function NotebookStoreProvider({
  children,
  store,
}: {
  children: ReactNode;
  store: NotebookStore;
}) {
  return (
    <NotebookStoreContext.Provider value={store}>
      {children}
    </NotebookStoreContext.Provider>
  );
}

export function useNotebookStore(): NotebookStore {
  const store = useContext(NotebookStoreContext);
  if (!store) {
    throw new Error('useNotebookStore must be used inside NotebookStoreProvider.');
  }
  return store;
}

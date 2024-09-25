import {createContext, useState} from 'react';

export type NewView = {
  label: string;
  query: string;
  /**
   * If true, the query will be saved to the view.
   * Otherwise, the query will act as an unsaved change.
   */
  saveQueryToView: boolean;
};

export interface NewTabContext {
  newViewActive: boolean;
  onNewViewsSaved: (newViews: NewView[]) => void;
  setNewViewActive: (isActive: boolean) => void;
  setOnNewViewsSaved: (onNewViewSaved: (newViews: NewView[]) => void) => void;
}

export const NewTabContext = createContext<NewTabContext>({
  newViewActive: false,
  setNewViewActive: () => {},
  onNewViewsSaved: () => {},
  setOnNewViewsSaved: () => {},
});

export function NewTabContextProvider({children}: {children: React.ReactNode}) {
  const [newViewActive, setNewViewActive] = useState<boolean>(false);
  const [onNewViewsSaved, setOnNewViewsSaved] = useState<
    NewTabContext['onNewViewsSaved']
  >(() => () => {});

  return (
    <NewTabContext.Provider
      value={{
        newViewActive,
        setNewViewActive,
        onNewViewsSaved,
        setOnNewViewsSaved,
      }}
    >
      {children}
    </NewTabContext.Provider>
  );
}

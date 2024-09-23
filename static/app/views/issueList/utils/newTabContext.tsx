import {createContext, useState} from 'react';

export interface NewTabContext {
  newViewActive: boolean;
  onNewViewSaved: (label: string, query: string, saveQueryToView: boolean) => void;
  setNewViewActive: (isActive: boolean) => void;
  setOnNewViewSaved: (
    onNewViewSaved: (label: string, query: string, saveQueryToView: boolean) => void
  ) => void;
}

export const NewTabContext = createContext<NewTabContext>({
  newViewActive: false,
  setNewViewActive: () => {},
  onNewViewSaved: () => {},
  setOnNewViewSaved: () => {},
});

export function NewTabContextProvider({children}: {children: React.ReactNode}) {
  const [newViewActive, setNewViewActive] = useState<boolean>(false);
  const [onNewViewSaved, setOnNewViewSaved] = useState<NewTabContext['onNewViewSaved']>(
    () => () => {}
  );

  return (
    <NewTabContext.Provider
      value={{
        newViewActive,
        setNewViewActive,
        onNewViewSaved,
        setOnNewViewSaved,
      }}
    >
      {children}
    </NewTabContext.Provider>
  );
}

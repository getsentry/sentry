import {createContext, useContext, useState} from 'react';

interface SelectedCodeTabContextValue {
  selectedTab: string | null;
  setSelectedTab: (tab: string) => void;
}

const SelectedCodeTabContext = createContext<SelectedCodeTabContextValue>({
  selectedTab: null,
  setSelectedTab: () => {},
});

export function SelectedCodeTabProvider({children}: {children: React.ReactNode}) {
  const [selectedTab, setSelectedTab] = useState<string | null>(null);
  return (
    <SelectedCodeTabContext value={{selectedTab, setSelectedTab}}>
      {children}
    </SelectedCodeTabContext>
  );
}

export function useSelectedCodeTab() {
  return useContext(SelectedCodeTabContext);
}

import {createContext, useContext, useMemo, useState} from 'react';

interface DDMContextValue {
  selectedWidgetIndex: number;
  setSelectedWidgetIndex: (index: number) => void;
}

export const DDMContext = createContext<DDMContextValue>({
  selectedWidgetIndex: 0,
  setSelectedWidgetIndex: () => {},
});

export function useDDMContext() {
  const context = useContext(DDMContext);
  if (!context) {
    throw new Error('useDDMContext must be used within a DDMContextProvider');
  }
  return context;
}

export function DDMContextProvider({children}: {children: React.ReactNode}) {
  const [selectedWidgetIndex, setSelectedWidgetIndex] = useState(0);

  const contextValue = useMemo<DDMContextValue>(
    () => ({
      selectedWidgetIndex,
      setSelectedWidgetIndex,
    }),
    [selectedWidgetIndex]
  );

  return <DDMContext.Provider value={contextValue}>{children}</DDMContext.Provider>;
}

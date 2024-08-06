import {createContext, type RefObject, useContext} from 'react';

type DrawerContainerRef = RefObject<HTMLDivElement> | null;

export const DrawerContainerRefContext = createContext<DrawerContainerRef>(null);

export const useDrawerContainerRef = () => {
  const context = useContext(DrawerContainerRefContext);
  if (context === null) {
    throw new Error(
      'useDrawerContainerRef must be used within DrawerContainerRefContext.Provider'
    );
  }
  return context;
};

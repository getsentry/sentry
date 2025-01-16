import {createContext, useContext, useMemo, useState} from 'react';

export interface NavContext {
  secondaryNavEl: HTMLElement | null;
  setSecondaryNavEl: (el: HTMLElement | null) => void;
}

const NavContext = createContext<NavContext>({
  secondaryNavEl: null,
  setSecondaryNavEl: () => {},
});

export function useNavContext(): NavContext {
  return useContext(NavContext);
}

export function NavContextProvider({children}) {
  const [secondaryNavEl, setSecondaryNavEl] = useState<HTMLElement | null>(null);

  const value = useMemo(
    () => ({secondaryNavEl, setSecondaryNavEl}),
    [secondaryNavEl, setSecondaryNavEl]
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

import React, {useContext, useState} from 'react';

export enum ScrollContextPositionTab {
  DOM = 'dom',
  CONSOLE = 'console',
  NETWORK = 'network',
  TRACE = 'trace',
  MEMORY = 'memory',
  ISSUES = 'issues',
}

type ScrollPosition = {
  id: keyof typeof ScrollContextPositionTab;
  scrollPosition: number;
};

type ScrollContextProps = {
  /**
   * The current scroll position
   */
  scrollPosition: ScrollPosition[];
  /**
   * Manually set the scroll position
   */
  setScrollPosition: React.Dispatch<React.SetStateAction<ScrollPosition[]>>;
};

const ScrollContext = React.createContext<ScrollContextProps>({
  scrollPosition: [],
  setScrollPosition: () => {},
});

type Props = {
  children: React.ReactNode;
};

export function ScrollContextProvider({children}: Props) {
  const [scrollPosition, setScrollPosition] = useState<ScrollPosition[]>([]);

  return (
    <ScrollContext.Provider
      value={{
        scrollPosition,
        setScrollPosition,
      }}
    >
      {children}
    </ScrollContext.Provider>
  );
}

export const useScrollContext = () => useContext(ScrollContext);

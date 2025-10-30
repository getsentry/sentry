import {createContext, useContext, useState} from 'react';

export const LineCoverageContext = createContext<{
  hasCoverageData: boolean;
  setHasCoverageData: (hasCoverageData: boolean) => void;
}>({
  hasCoverageData: false,
  setHasCoverageData: () => {},
});

export function LineCoverageProvider({children}: {children: React.ReactNode}) {
  const [hasCoverageData, setHasCoverageData] = useState(false);
  return (
    <LineCoverageContext.Provider value={{hasCoverageData, setHasCoverageData}}>
      {children}
    </LineCoverageContext.Provider>
  );
}

export const useLineCoverageContext = () => {
  return useContext(LineCoverageContext);
};

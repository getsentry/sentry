import {createContext, useContext, useState} from 'react';

// This context is used to track whether any of the frames in the exception have line
// coverage data to accurately display the line coverage legend if relevant.
const LineCoverageContext = createContext<{
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

import {createContext, ReactNode, useContext} from 'react';

import useFetchThresholdsListData, {
  EMPTY_THRESHOLDS_LIST_DATA,
  HookProps,
} from '../utils/useFetchThresholdsListData';

interface ProviderProps extends HookProps {
  children: ReactNode;
}

const ThresholdsListDataContext = createContext<
  ReturnType<typeof useFetchThresholdsListData>
>(EMPTY_THRESHOLDS_LIST_DATA);

export function ThresholdsDataContext({children, ...listDataParams}: ProviderProps) {
  const contextValue = useFetchThresholdsListData(listDataParams);

  return (
    <ThresholdsListDataContext.Provider value={contextValue}>
      {children}
    </ThresholdsListDataContext.Provider>
  );
}

export const useThresholdsListData = () => useContext(ThresholdsListDataContext);

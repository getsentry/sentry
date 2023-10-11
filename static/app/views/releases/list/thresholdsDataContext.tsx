import {createContext, ReactNode, useContext} from 'react';

import useFetchThresholdsListData, {HookProps} from '../utils/useFetchThresholdsListData';

export const EMPTY_THRESHOLDS_LIST_DATA: ReturnType<typeof useFetchThresholdsListData> = {
  isError: false,
  isLoading: false,
  thresholds: [],
};

interface ProviderProps extends HookProps {
  children: ReactNode;
}

const ThresholdsListDataContext = createContext<
  ReturnType<typeof useFetchThresholdsListData>
>(EMPTY_THRESHOLDS_LIST_DATA);

export function ThresholdsDataContext({
  children,
  selectedEnvs,
  selectedProjects,
}: ProviderProps) {
  const contextValue = useFetchThresholdsListData({selectedEnvs, selectedProjects});

  return (
    <ThresholdsListDataContext.Provider value={contextValue}>
      {children}
    </ThresholdsListDataContext.Provider>
  );
}

export const useThresholdsListData = () => useContext(ThresholdsListDataContext);

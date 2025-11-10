import {createContext, useContext, useMemo, useState} from 'react';

import type {ChartInfo} from 'sentry/views/explore/components/chart/types';
import type {BoxSelectOptions} from 'sentry/views/explore/hooks/useChartBoxSelect';

type ChartSelectionState = {
  boxSelectOptions: BoxSelectOptions;
  chartInfo: ChartInfo;
} | null;

type ChartSelectionContextValue = {
  chartSelection: ChartSelectionState;
  setChartSelection: (state: ChartSelectionState) => void;
};

const ChartSelectionContext = createContext<ChartSelectionContextValue | undefined>(
  undefined
);

interface ChartSelectionProviderProps {
  children: React.ReactNode;
}

export function ChartSelectionProvider({children}: ChartSelectionProviderProps) {
  const [chartSelection, setChartSelection] = useState<ChartSelectionState>(null);

  const value = useMemo<ChartSelectionContextValue>(
    () => ({
      setChartSelection,
      chartSelection,
    }),
    [chartSelection, setChartSelection]
  );

  return (
    <ChartSelectionContext.Provider value={value}>
      {children}
    </ChartSelectionContext.Provider>
  );
}

export function useChartSelection(): ChartSelectionContextValue {
  const context = useContext(ChartSelectionContext);

  if (context === undefined) {
    throw new Error('useChartSelection must be used within a ChartSelectionProvider');
  }

  return context;
}

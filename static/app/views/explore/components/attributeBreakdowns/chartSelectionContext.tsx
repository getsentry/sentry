import {createContext, useContext, useMemo} from 'react';
import {createParser, useQueryState} from 'nuqs';

import type {Selection} from 'sentry/components/charts/useChartXRangeSelection';
import {UrlParamBatchProvider} from 'sentry/utils/url/urlParamBatchContext';

export type ChartSelectionQueryParam = {
  chartIndex: number;
  panelId: string;
  range: [number, number];
};

type ChartSelectionState = {
  chartIndex: number;
  selection: Selection;
} | null;

type ChartSelectionContextValue = {
  chartSelection: ChartSelectionState;
  setChartSelection: (state: ChartSelectionState | null) => void;
};

const ChartSelectionContext = createContext<ChartSelectionContextValue | undefined>(
  undefined
);

interface ChartSelectionProviderProps {
  children: React.ReactNode;
}

const parseAsChartSelection = createParser<ChartSelectionState>({
  parse(value: string): ChartSelectionState | null {
    try {
      const parsed = JSON.parse(value);

      if (
        typeof parsed.chartIndex === 'number' &&
        Array.isArray(parsed.range) &&
        parsed.range.length === 2 &&
        typeof parsed.range[0] === 'number' &&
        typeof parsed.range[1] === 'number' &&
        typeof parsed.panelId === 'string'
      ) {
        return {
          chartIndex: parsed.chartIndex,
          selection: {
            range: parsed.range as [number, number],
            panelId: parsed.panelId,
          },
        };
      }
    } catch {
      return null;
    }

    return null;
  },
  serialize(state: ChartSelectionState): string {
    if (!state) {
      return '';
    }

    const chartSelection: ChartSelectionQueryParam = {
      chartIndex: state.chartIndex,
      range: state.selection.range,
      panelId: state.selection.panelId,
    };

    return JSON.stringify(chartSelection);
  },
});

export function ChartSelectionProvider({children}: ChartSelectionProviderProps) {
  const [chartSelection, setChartSelection] = useQueryState(
    'chartSelection',
    parseAsChartSelection
  );

  const value = useMemo<ChartSelectionContextValue>(
    () => ({
      chartSelection,
      setChartSelection,
    }),
    [chartSelection, setChartSelection]
  );

  // TODO: Remove UrlParamBatchProvider once all child components using useQueryParamState
  // have been migrated to nuqs. Current remaining usages:
  // - attributeDistributionContent.tsx
  // - cohortComparisonContent.tsx
  return (
    <UrlParamBatchProvider>
      <ChartSelectionContext.Provider value={value}>
        {children}
      </ChartSelectionContext.Provider>
    </UrlParamBatchProvider>
  );
}

export function useChartSelection(): ChartSelectionContextValue {
  const context = useContext(ChartSelectionContext);

  if (context === undefined) {
    throw new Error('useChartSelection must be used within a ChartSelectionProvider');
  }

  return context;
}

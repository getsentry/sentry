import {createContext, useContext, useMemo} from 'react';

import type {Selection} from 'sentry/components/charts/useChartXRangeSelection';
import {UrlParamBatchProvider} from 'sentry/utils/url/urlParamBatchContext';
import {useQueryParamState} from 'sentry/utils/url/useQueryParamState';

type ChartSelectionState = {
  chartIndex: number;
  selection: Selection;
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

function serializeChartSelection(state: ChartSelectionState): string {
  if (!state) {
    return '';
  }

  return JSON.stringify({
    chartIndex: state.chartIndex,
    range: state.selection.range,
    panelId: state.selection.panelId,
  });
}

function deserializeChartSelection(value: string | undefined): ChartSelectionState {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);

    // Validate the parsed data
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
}

function ChartSelectionStateProvider({children}: ChartSelectionProviderProps) {
  const [chartSelection, setChartSelection] = useQueryParamState<ChartSelectionState>({
    fieldName: 'chartSelection',
    deserializer: deserializeChartSelection,
    serializer: serializeChartSelection,
    syncStateWithUrl: true,
  });

  const value = useMemo<ChartSelectionContextValue>(
    () => ({
      chartSelection: chartSelection ?? null,
      setChartSelection,
    }),
    [chartSelection, setChartSelection]
  );

  return (
    <ChartSelectionContext.Provider value={value}>
      {children}
    </ChartSelectionContext.Provider>
  );
}

export function ChartSelectionProvider({children}: ChartSelectionProviderProps) {
  return (
    <UrlParamBatchProvider>
      <ChartSelectionStateProvider>{children}</ChartSelectionStateProvider>
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

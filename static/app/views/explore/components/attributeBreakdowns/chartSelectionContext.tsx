import {createContext, useContext, useMemo} from 'react';
import {createParser, parseAsJson, useQueryState} from 'nuqs';
import {z} from 'zod';

import type {Selection} from 'sentry/components/charts/useChartXRangeSelection';

const chartSelectionQueryParamSchema = z.object({
  chartIndex: z.number(),
  panelId: z.string(),
  range: z.tuple([z.number(), z.number()]),
});

export type ChartSelectionQueryParam = z.infer<typeof chartSelectionQueryParamSchema>;

const parseAsChartSelectionQueryParam = parseAsJson(chartSelectionQueryParamSchema);

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
    const parsed = parseAsChartSelectionQueryParam.parse(value);
    if (!parsed) {
      return null;
    }

    return {
      chartIndex: parsed.chartIndex,
      selection: {
        range: parsed.range,
        panelId: parsed.panelId,
      },
    };
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

    return parseAsChartSelectionQueryParam.serialize(chartSelection);
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

  return <ChartSelectionContext value={value}>{children}</ChartSelectionContext>;
}

export function useChartSelection(): ChartSelectionContextValue {
  const context = useContext(ChartSelectionContext);

  if (context === undefined) {
    throw new Error('useChartSelection must be used within a ChartSelectionProvider');
  }

  return context;
}

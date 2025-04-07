import {createContext, type ReactElement, useCallback, useMemo, useRef} from 'react';

import type {ChartRendererProps} from 'sentry/views/releases/releaseBubbles/types';

type ChartRenderer = (props: ChartRendererProps) => ReactElement;

export const ReleasesDrawerContext = createContext<{
  getChart: (id: string) => ChartRenderer | undefined;
  registerChart: (id: string, chartRenderer: ChartRenderer) => void;
}>({
  getChart: () => undefined,
  registerChart: () => {},
});

export function ReleasesDrawerProvider({children}: {children: ReactElement}) {
  const chartMapRef = useRef(new Map<string, ChartRenderer>());

  const registerChart = useCallback(
    (id: string, chartRenderer: ChartRenderer) => {
      chartMapRef.current.set(id, chartRenderer);
    },
    [chartMapRef]
  );
  const getChart = useCallback((id: string) => chartMapRef.current.get(id), []);
  const context = useMemo(
    () => ({
      registerChart,
      getChart,
    }),
    [getChart, registerChart]
  );

  return <ReleasesDrawerContext value={context}>{children}</ReleasesDrawerContext>;
}

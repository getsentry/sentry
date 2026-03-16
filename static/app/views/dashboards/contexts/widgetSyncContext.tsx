import type {ReactNode} from 'react';
import {useCallback, useEffect, useMemo, useRef} from 'react';
import type {EChartsType} from 'echarts';
import * as echarts from 'echarts';

import {uniqueId} from 'sentry/utils/guid';
import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';

type UnregisterFunction = () => void;
type RegistrationFunction = (chart: EChartsType) => UnregisterFunction;

interface WidgetSyncContext {
  groupName: string;
  register: RegistrationFunction;
}

const [_WidgetSyncProvider, _useWidgetSyncContext, WidgetSyncContext] =
  createDefinedContext<WidgetSyncContext>({
    name: 'WidgetSyncContext',
    strict: false,
  });

interface WidgetSyncContextProviderProps {
  children: ReactNode;
  groupName?: string;
}

export function WidgetSyncContextProvider({
  children,
  groupName,
}: WidgetSyncContextProviderProps) {
  // Stabilize the default groupName so it doesn't change on every render
  const stableGroupName = useMemo(() => groupName ?? uniqueId(), [groupName]);
  const chartsRef = useRef<Map<Element, EChartsType>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  const getOrCreateObserver = useCallback(() => {
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(entries => {
        for (const entry of entries) {
          const chart = chartsRef.current.get(entry.target);
          if (!chart) {
            continue;
          }

          if (entry.isIntersecting) {
            chart.group = stableGroupName;
          } else {
            chart.group = '';
          }
        }

        echarts?.connect(stableGroupName);
      });
    }
    return observerRef.current;
  }, [stableGroupName]);

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [stableGroupName]);

  const register = useCallback(
    (chart: EChartsType): UnregisterFunction => {
      const dom = chart.getDom();
      if (!dom) {
        return () => {};
      }

      chartsRef.current.set(dom, chart);
      getOrCreateObserver().observe(dom);

      // Set the group immediately for charts that may already be visible
      chart.group = stableGroupName;
      echarts?.connect(stableGroupName);

      // Return a function to unregister the chart
      return () => {
        chartsRef.current.delete(dom);
        observerRef.current?.unobserve(dom);
        chart.group = '';
      };
    },
    [stableGroupName, getOrCreateObserver]
  );

  return (
    <_WidgetSyncProvider
      value={{
        register,
        groupName: stableGroupName,
      }}
    >
      {children}
    </_WidgetSyncProvider>
  );
}

export function useWidgetSyncContext(): WidgetSyncContext {
  const context = _useWidgetSyncContext();

  if (!context) {
    // The provider was not registered, return a dummy function
    return {
      register: (_p: any) => () => {},
      groupName: '',
    };
  }

  return context;
}

import type {ReactNode} from 'react';
import {useCallback, useEffect, useRef} from 'react';
import type {EChartsType} from 'echarts';
import * as echarts from 'echarts';

import {uniqueId} from 'sentry/utils/guid';
import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';

type RegistrationFunction = (chart: EChartsType) => void;

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
  groupName = uniqueId(),
}: WidgetSyncContextProviderProps) {
  const chartsRef = useRef<Set<EChartsType>>(new Set());
  const visibleDomsRef = useRef<Set<HTMLElement>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Create the observer once. A generous rootMargin means charts that are
  // *almost* scrolled into view are pre-connected, avoiding a flash of
  // un-synced state as the user scrolls.
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      entries => {
        let changed = false;

        for (const entry of entries) {
          const dom = entry.target as HTMLElement;
          if (entry.isIntersecting) {
            if (!visibleDomsRef.current.has(dom)) {
              visibleDomsRef.current.add(dom);
              changed = true;
            }
          } else if (visibleDomsRef.current.has(dom)) {
            visibleDomsRef.current.delete(dom);
            changed = true;
          }
        }

        if (changed) {
          updateChartGroups();
        }
      },
      {rootMargin: '200px'}
    );

    return () => {
      observerRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateChartGroups() {
    for (const chart of chartsRef.current) {
      if (chart.isDisposed?.()) {
        continue;
      }

      const dom = chart.getDom();
      if (visibleDomsRef.current.has(dom)) {
        // Visible — join the sync group
        chart.group = groupName;
      } else {
        // Not visible — leave the sync group so ECharts skips it
        chart.group = undefined as any;
      }
    }

    // Re-connect so ECharts picks up the updated group membership
    echarts?.connect(groupName);
  }

  const register: RegistrationFunction = useCallback(
    (chart: EChartsType) => {
      chartsRef.current.add(chart);

      const dom = chart.getDom();
      observerRef.current?.observe(dom);

      // If the chart is already visible at registration time, connect it
      // immediately. The observer callback may not fire synchronously.
      chart.group = groupName;
      echarts?.connect(groupName);
    },
    [groupName]
  );

  return (
    <_WidgetSyncProvider
      value={{
        register,
        groupName,
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
      register: (_p: any) => null,
      groupName: '',
    };
  }

  return context;
}

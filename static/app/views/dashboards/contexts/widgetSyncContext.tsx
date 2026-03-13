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
  const chartsRef = useRef<Map<Element, EChartsType>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const chart = chartsRef.current.get(entry.target);
        if (!chart) {
          continue;
        }

        if (entry.isIntersecting) {
          chart.group = groupName;
        } else {
          chart.group = '';
        }
      }

      echarts?.connect(groupName);
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [groupName]);

  const register = useCallback(
    (chart: EChartsType) => {
      const dom = chart.getDom();
      if (!dom) {
        return;
      }

      chartsRef.current.set(dom, chart);
      observerRef.current?.observe(dom);

      // Set the group immediately for charts that may already be visible
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

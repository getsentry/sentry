import type {ReactNode} from 'react';
import {createContext, useCallback, useContext, useEffect, useMemo, useRef} from 'react';
import type {EChartsType} from 'echarts';
import * as echarts from 'echarts';

import {uniqueId} from 'sentry/utils/guid';

type UnregisterFunction = () => void;
type RegistrationFunction = (chart: EChartsType) => UnregisterFunction;

interface WidgetSyncContext {
  groupName: string;
  register: RegistrationFunction;
}

const WidgetSyncCtx = createContext<WidgetSyncContext | undefined>(undefined);

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
  const observerRef = useRef<IntersectionObserver | null>(null);

  const getOrCreateObserver = useCallback(() => {
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(entries => {
        for (const entry of entries) {
          // Skip detached DOM nodes — they can appear in the observer callback
          // during component unmount/navigation and cause echarts to call
          // getAttribute on a null element (echarts-for-react race condition).
          if (!entry.target.isConnected) {
            continue;
          }
          const chart = echarts.getInstanceByDom(entry.target as HTMLElement);
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

      getOrCreateObserver().observe(dom);

      // Set the group immediately for charts that may already be visible
      chart.group = stableGroupName;
      echarts?.connect(stableGroupName);

      // Return a function to unregister the chart
      return () => {
        observerRef.current?.unobserve(dom);
        chart.group = '';
      };
    },
    [stableGroupName, getOrCreateObserver]
  );

  return (
    <WidgetSyncCtx
      value={{
        register,
        groupName: stableGroupName,
      }}
    >
      {children}
    </WidgetSyncCtx>
  );
}

export function useWidgetSyncContext(): WidgetSyncContext {
  const context = useContext(WidgetSyncCtx);

  if (!context) {
    // The provider was not registered, return a dummy function
    return {
      register: (_p: any) => () => {},
      groupName: '',
    };
  }

  return context;
}

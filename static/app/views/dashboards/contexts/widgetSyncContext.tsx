import type {ReactNode} from 'react';
import type {EChartsType} from 'echarts';
import * as echarts from 'echarts';

import {uniqueId} from 'sentry/utils/guid';
import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';

type RegistrationFunction = (chart: EChartsType) => void;

interface WidgetSyncContext {
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
  const register: RegistrationFunction = chart => {
    chart.group = groupName;
    // eslint-disable-next-line import/namespace
    echarts?.connect(groupName);
  };

  return (
    <_WidgetSyncProvider
      value={{
        register,
      }}
    >
      {children}
    </_WidgetSyncProvider>
  );
}

export {WidgetSyncContext};

export function useWidgetSyncContext(): WidgetSyncContext {
  const context = _useWidgetSyncContext();

  if (!context) {
    // The provider was not registered, return a dummy function
    return {
      register: (_p: any) => null,
    };
  }

  return context;
}

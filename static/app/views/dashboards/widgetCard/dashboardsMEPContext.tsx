import type {ReactNode} from 'react';
import {useState} from 'react';

import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';

interface DashboardsMEPContextInterface {
  setIsMetricsData: (value?: boolean) => void;
  isMetricsData?: boolean;
}

const [_DashboardsMEPProvider, useDashboardsMEPContext, DashboardsMEPContext] =
  createDefinedContext<DashboardsMEPContextInterface>({
    name: 'DashboardsMEPContext',
  });

function DashboardsMEPProvider({children}: {children: ReactNode}) {
  const [isMetricsData, setIsMetricsData] = useState<boolean | undefined>(undefined); // undefined means not initialized

  return (
    <_DashboardsMEPProvider
      value={{
        isMetricsData,
        setIsMetricsData,
      }}
    >
      {children}
    </_DashboardsMEPProvider>
  );
}

export {DashboardsMEPProvider, useDashboardsMEPContext};

/** @internal exported for tests */
export {DashboardsMEPContext};

import type {ReactNode} from 'react';
import {createContext, useContext, useState} from 'react';

interface DashboardsMEPContextInterface {
  setIsMetricsData: (value?: boolean) => void;
  isMetricsData?: boolean;
}

const DashboardsMEPContext = createContext<DashboardsMEPContextInterface | undefined>(
  undefined
);

function useDashboardsMEPContext(): DashboardsMEPContextInterface {
  const context = useContext(DashboardsMEPContext);
  if (context === undefined) {
    throw new Error(
      'useContext for "DashboardsMEPContext" must be inside a Provider with a value'
    );
  }
  return context;
}

function DashboardsMEPProvider({children}: {children: ReactNode}) {
  const [isMetricsData, setIsMetricsData] = useState<boolean | undefined>(undefined); // undefined means not initialized

  return (
    <DashboardsMEPContext
      value={{
        isMetricsData,
        setIsMetricsData,
      }}
    >
      {children}
    </DashboardsMEPContext>
  );
}

export {DashboardsMEPProvider, useDashboardsMEPContext};

/** @internal exported for tests */
export {DashboardsMEPContext};

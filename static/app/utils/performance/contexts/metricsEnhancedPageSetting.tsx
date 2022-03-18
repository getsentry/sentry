import {ReactNode, useState} from 'react';

import {useMEPSettingContext} from './metricsEnhancedSetting';
import {createDefinedContext} from './utils';

interface MetricsEnhancedPageSettingContext {
  isMEPEnabled: boolean;
  setMEPEnabled: (value: boolean) => void;
}

const [_MEPPageSettingProvider, _useMEPPageSettingContext] =
  createDefinedContext<MetricsEnhancedPageSettingContext>({
    name: 'MetricsEnhancedPerformanceDataContext',
  });

// Used to switch metric setting on a page without persisting (as in landing)
// Pulls the default state of MEP from the global (which comes from local storage).
export const MEPPageSettingProvider = ({children}: {children: ReactNode}) => {
  const {isMEPEnabled: globalMEPEnabled} = useMEPSettingContext();
  const [isMEPEnabled, setMEPEnabled] = useState(globalMEPEnabled);
  return (
    <_MEPPageSettingProvider value={{isMEPEnabled, setMEPEnabled}}>
      {children}
    </_MEPPageSettingProvider>
  );
};

export const useMEPPageSettingContext = _useMEPPageSettingContext;

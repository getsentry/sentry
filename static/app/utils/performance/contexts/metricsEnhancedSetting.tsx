import {ReactNode, useState} from 'react';

import localStorage from 'sentry/utils/localStorage';

import {createDefinedContext} from './utils';

const storageKey = 'performance.metrics-enhanced-setting';

interface MetricsEnhancedSettingContext {
  isMEPEnabled: boolean;
  setMEPEnabled: (value: boolean) => void;
}

const [_MEPSettingProvider, _useMEPSettingContext, MEPSettingContext] =
  createDefinedContext<MetricsEnhancedSettingContext>({
    name: 'MetricsEnhancedSettingContext',
  });

export const MEPConsumer = MEPSettingContext.Consumer;

export const MEPSettingProvider = ({
  children,
  _isMEPEnabled,
}: {
  children: ReactNode;
  _isMEPEnabled?: boolean;
}) => {
  const isControlledMEPEnabled = typeof _isMEPEnabled === 'boolean';
  const [isMEPEnabled, _setMEPEnabled] = useState<boolean>(
    isControlledMEPEnabled ? _isMEPEnabled : localStorage.getItem(storageKey) !== 'false'
  );

  function setMEPEnabled(value: boolean) {
    _setMEPEnabled(value);
    localStorage.setItem(storageKey, value ? 'true' : 'false');
  }
  return (
    <_MEPSettingProvider value={{isMEPEnabled, setMEPEnabled}}>
      {children}
    </_MEPSettingProvider>
  );
};

export const useMEPSettingContext = _useMEPSettingContext;

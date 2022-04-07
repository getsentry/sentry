import React, {useReducer, useState} from 'react';

import LegacyConfigStore from 'sentry/stores/configStore';
import {ConfigContext} from 'sentry/stores/configStore/configContext';
import {configReducer} from 'sentry/stores/configStore/configReducer';
import {Config} from 'sentry/types';

interface ConfigProviderProps {
  children: React.ReactNode;
  initialValue: Config;
}

export function ConfigProvider(props: ConfigProviderProps) {
  const [signalState, setSignalState] = useState({});
  const contextValue = useReducer(configReducer, props.initialValue);

  const dispatch = () => {
    setSignalState({});
  };

  return (
    <ConfigContext.Provider value={[LegacyConfigStore.config, dispatch]}>
      {props.children}
    </ConfigContext.Provider>
  );
}

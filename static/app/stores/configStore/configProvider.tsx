import React, {useState} from 'react';

import LegacyConfigStore from 'sentry/stores/configStore';
import {ConfigContext} from 'sentry/stores/configStore/configContext';
import {Config} from 'sentry/types';
import {useEffect} from 'react';

interface ConfigProviderProps {
  children: React.ReactNode;
  initialValue: Config;
}

export function ConfigProvider(props: ConfigProviderProps) {
  const [signalState, setSignalState] = useState({});

  const dispatch = (updateFn: (store: typeof LegacyConfigStore) => void) => {
    updateFn(LegacyConfigStore);
    setSignalState({});
  };

  useEffect(() => {
    const listener = LegacyConfigStore.listen(changes => {
      setSignalState({});
    }, {});

    return () => listener();
  }, []);

  return (
    <ConfigContext.Provider value={[LegacyConfigStore.config, dispatch]}>
      {props.children}
    </ConfigContext.Provider>
  );
}

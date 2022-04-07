import {useEffect, useReducer} from 'react';

import LegacyConfigStore from 'sentry/stores/configStore';
import {ConfigContext} from 'sentry/stores/configStore/configContext';
import {
  configReducer,
  makeBridgableReducer,
} from 'sentry/stores/configStore/configReducer';
import {Config} from 'sentry/types';

interface ConfigProviderProps {
  children: React.ReactNode;
  initialValue: Config;
}

export function ConfigProvider(props: ConfigProviderProps) {
  const contextValue = useReducer(
    makeBridgableReducer(configReducer),
    props.initialValue
  );

  useEffect(() => {
    const [_, dispatch] = contextValue;

    // @ts-ignore we need to bind the listener to a context, hence the variable name,
    // but sadly typescript complains about shadowing here
    const bindContext = this;
    const unsubscribeListener = LegacyConfigStore.listen(changes => {
      dispatch({type: 'patch', payload: changes});
    }, bindContext);

    return () => {
      unsubscribeListener();
    };
  }, []);

  return (
    <ConfigContext.Provider value={contextValue}>{props.children}</ConfigContext.Provider>
  );
}

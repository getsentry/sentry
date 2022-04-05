import {useEffect, useReducer, useRef} from 'react';

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
  bridgeReflux?: boolean;
}

export function ConfigProvider(props: ConfigProviderProps) {
  const initialBridgeRefluxValue = useRef<ConfigProviderProps['bridgeReflux']>(
    props.bridgeReflux
  );
  const contextValue = useReducer(
    makeBridgableReducer(configReducer, props.bridgeReflux ?? false),
    props.initialValue
  );

  useEffect(() => {
    if (initialBridgeRefluxValue.current !== props.bridgeReflux) {
      throw new Error(
        `bridgeReflux must not change between rerenders. This may result in undefined and out of sync behavior between the two stores. bridgeReflux changed from ${initialBridgeRefluxValue.current} -> ${props.bridgeReflux}`
      );
    }

    if (!props.bridgeReflux) {
      return undefined;
    }

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
  }, [props.bridgeReflux]);

  return (
    <ConfigContext.Provider value={contextValue}>{props.children}</ConfigContext.Provider>
  );
}

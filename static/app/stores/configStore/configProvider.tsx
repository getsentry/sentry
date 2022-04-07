import {useEffect, useReducer, useCallback, useMemo} from 'react';

import LegacyConfigStore from 'sentry/stores/configStore';
import {ConfigContext, ConfigContextValue} from 'sentry/stores/configStore/configContext';
import {configReducer} from 'sentry/stores/configStore/configReducer';
import {Config} from 'sentry/types';

interface ConfigProviderProps {
  children: React.ReactNode;
  initialValue: Config;
}

export function ConfigProvider(props: ConfigProviderProps) {
  const contextValue = useReducer(configReducer, props.initialValue);

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

  const wrappedDispatch: ConfigContextValue[1] = useCallback(
    action => {
      console.log(action);
      switch (action.type) {
        case 'set config value': {
          LegacyConfigStore.set(action.payload.key, action.payload.value);
          break;
        }
        case 'set theme': {
          LegacyConfigStore.updateTheme(action.payload);
          break;
        }
        default: {
          console.warn('Unhandled reducer action');
        }
      }

      const reducerDispatch = contextValue[1];
      reducerDispatch(action);
    },
    [contextValue[0], contextValue[1]]
  );

  const wrappedContextValue = useMemo((): ConfigContextValue => {
    return [contextValue[0], wrappedDispatch];
  }, [contextValue[0], wrappedDispatch]);

  return (
    <ConfigContext.Provider value={wrappedContextValue}>
      {props.children}
    </ConfigContext.Provider>
  );
}

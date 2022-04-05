import {useReducer} from 'react';

import {ConfigContext} from 'sentry/stores/configStore/configContext';
import {Config} from 'sentry/types';

import {configReducer} from './configReducer';

export function ConfigProvider(props: {children: React.ReactNode; initialValue: Config}) {
  const contextValue = useReducer(configReducer, props.initialValue);

  return (
    <ConfigContext.Provider value={contextValue}>{props.children}</ConfigContext.Provider>
  );
}

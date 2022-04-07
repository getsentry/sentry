import {createContext} from 'react';

import {ConfigAction, ConfigState} from './configReducer';

export type ConfigContextValue = [
  ConfigState,
  React.Dispatch<ConfigAction<keyof ConfigState>>
];

export const ConfigContext = createContext<ConfigContextValue | null>(null);

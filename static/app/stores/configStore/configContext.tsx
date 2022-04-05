import {createContext} from 'react';

import {ConfigAction, ConfigState} from './configReducer';

export const ConfigContext = createContext<
  [ConfigState, React.Dispatch<ConfigAction<keyof ConfigState>>] | null
>(null);

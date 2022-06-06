import {createContext} from 'react';

import {SelectFilterTokenParams} from './types';

export type SelectedTokenContextType = {
  selection?: SelectFilterTokenParams;
  setSelectedToken?: (s?: SelectFilterTokenParams) => void;
};

export const SelectedTokenContext = createContext<SelectedTokenContextType>({});

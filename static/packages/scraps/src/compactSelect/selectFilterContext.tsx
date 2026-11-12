import {createContext} from 'react';

import type {SelectKey} from './types';

export const SelectFilterContext = createContext(new Set<SelectKey>());

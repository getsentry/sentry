import {createContext} from 'react';
import type {TabListState} from '@react-stately/tabs';

import type {InternalTabsProps} from './tabs';

interface TabContext {
  rootProps: Omit<InternalTabsProps, 'children'> &
    Required<Pick<InternalTabsProps, 'orientation' | 'size'>>;
  setTabListState: (state: TabListState<any>) => void;
  tabListState?: TabListState<any>;
}

export const TabsContext = createContext<TabContext>({
  rootProps: {kind: 'selection', orientation: 'horizontal', size: 'md'},
  setTabListState: () => {},
});

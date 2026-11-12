import {createContext} from 'react';
import type {TabListState} from '@react-stately/tabs';

import type {TabsProps} from './tabs';

interface TabContext {
  rootProps: Omit<TabsProps<any>, 'children'> &
    Required<Pick<TabsProps<any>, 'orientation' | 'size'>>;
  setTabListState: (state: TabListState<any>) => void;
  tabListState?: TabListState<any>;
}

export const TabsContext = createContext<TabContext>({
  rootProps: {orientation: 'horizontal', size: 'md'},
  setTabListState: () => {},
});

import type {JSX, ReactNode} from 'react';
import {useState} from 'react';
import type {AriaTabListOptions} from '@react-aria/tabs';
import type {TabListState, TabListStateOptions} from '@react-stately/tabs';

import {TabsContext} from './context';
import type {TabListItemProps, TabPanelItemProps} from './item';
import type {TabProps} from './tab';
import {TabList, type TabListProps} from './tabList';
import {TabPanels, type TabPanelsProps} from './tabPanels';

export type TabKey = string;

export interface TabsComponents<T extends TabKey> {
  TabList: {
    (props: TabListProps): JSX.Element;
    Item: (props: TabListItemProps<T>) => JSX.Element;
  };
  TabPanels: {
    (props: TabPanelsProps): JSX.Element | null;
    Item: (props: TabPanelItemProps<T>) => JSX.Element;
  };
}

export interface TabsProps<T extends TabKey>
  extends
    Omit<
      AriaTabListOptions<any>,
      'selectedKey' | 'defaultSelectedKey' | 'onSelectionChange' | 'isDisabled'
    >,
    Omit<
      TabListStateOptions<any>,
      | 'children'
      | 'selectedKey'
      | 'defaultSelectedKey'
      | 'onSelectionChange'
      | 'isDisabled'
    > {
  children: (components: TabsComponents<T>) => ReactNode;
  /** Initial selected key for uncontrolled tabs. */
  defaultValue?: T;
  disabled?: boolean;
  disabledKeys?: Iterable<NoInfer<T>>;
  onChange?: (key: NoInfer<T>) => void;
  size?: TabProps['size'];
  /** Selected key for controlled tabs. */
  value?: T;
}

function TabStateProvider({
  children,
  orientation = 'horizontal',
  size = 'md',
  ...props
}: Omit<TabsProps<TabKey>, 'children'> & {children: ReactNode}) {
  const [tabListState, setTabListState] = useState<TabListState<any>>();

  return (
    <TabsContext
      value={{rootProps: {orientation, size, ...props}, tabListState, setTabListState}}
    >
      {children}
    </TabsContext>
  );
}

const components = {TabList, TabPanels};

function TabsRoot({children, ...props}: TabsProps<TabKey>) {
  return <TabStateProvider {...props}>{children(components)}</TabStateProvider>;
}

// Bind the key type without wrapping the collection items or changing their identity.
export const Tabs = TabsRoot as <T extends TabKey>(props: TabsProps<T>) => JSX.Element;

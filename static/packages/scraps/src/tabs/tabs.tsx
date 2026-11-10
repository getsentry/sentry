import type {JSX, ReactNode} from 'react';
import {useState} from 'react';
import type {AriaTabListOptions} from '@react-aria/tabs';
import type {TabListState, TabListStateOptions} from '@react-stately/tabs';

import {Flex} from '@sentry/scraps/layout';

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

interface BaseTabsProps
  extends
    Omit<
      AriaTabListOptions<any>,
      | 'selectedKey'
      | 'defaultSelectedKey'
      | 'onSelectionChange'
      | 'isDisabled'
      | 'disabledKeys'
    >,
    Omit<
      TabListStateOptions<any>,
      | 'children'
      | 'selectedKey'
      | 'defaultSelectedKey'
      | 'onSelectionChange'
      | 'isDisabled'
      | 'disabledKeys'
    > {
  className?: string;
  disabled?: boolean;
  size?: TabProps['size'];
}

export type TabsProps<T extends TabKey = TabKey> = BaseTabsProps &
  (
    | {
        children: (components: TabsComponents<NoInfer<T>>) => ReactNode;
        onChange: (key: NoInfer<T>) => void;
        value: T;
        defaultValue?: never;
        disabledKeys?: Iterable<NoInfer<T>>;
      }
    | {
        children: (components: TabsComponents<TabKey>) => ReactNode;
        defaultValue: TabKey;
        disabledKeys?: Iterable<TabKey>;
        onChange?: (key: TabKey) => void;
        value?: never;
      }
  );

function TabStateProvider({
  children,
  orientation = 'horizontal',
  size = 'md',
  ...props
}: Omit<TabsProps, 'children'> & {children: ReactNode}) {
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

function TabsRoot({
  children,
  className,
  orientation = 'horizontal',
  ...props
}: TabsProps) {
  return (
    <TabStateProvider orientation={orientation} {...props}>
      <Flex
        className={className}
        direction={orientation === 'horizontal' ? 'column' : 'row'}
        flexGrow={1}
        minWidth="0"
        flexBasis={orientation === 'horizontal' ? '0' : 'auto'}
        alignSelf={orientation === 'horizontal' ? 'stretch' : 'auto'}
        height={orientation === 'vertical' ? '100%' : undefined}
        align={orientation === 'vertical' ? 'stretch' : undefined}
      >
        {children(components)}
      </Flex>
    </TabStateProvider>
  );
}

// Bind the key type without wrapping the collection items or changing their identity.
export const Tabs = TabsRoot as <T extends TabKey>(props: TabsProps<T>) => JSX.Element;

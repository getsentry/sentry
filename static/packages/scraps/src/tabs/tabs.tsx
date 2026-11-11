import type {JSX, ReactNode} from 'react';
import {useState} from 'react';
import type {AriaTabListOptions} from '@react-aria/tabs';
import type {TabListState, TabListStateOptions} from '@react-stately/tabs';

import {Flex} from '@sentry/scraps/layout';

import {TabsContext} from './context';
import type {LinkTabListItemProps, TabListItemProps, TabPanelItemProps} from './item';
import type {TabProps} from './tab';
import {TabList, type TabListProps} from './tabList';
import {TabPanels, type TabPanelsProps} from './tabPanels';

export type TabKey = string;

interface Components<T extends TabKey, I> {
  TabList: {
    (props: TabListProps): JSX.Element;
    Item: (props: I) => JSX.Element;
  };
  TabPanels: {
    (props: TabPanelsProps): JSX.Element | null;
    Item: (props: TabPanelItemProps<T>) => JSX.Element;
  };
}

export type TabsComponents<T extends TabKey> = Components<T, TabListItemProps<T>>;
export type LinkTabsComponents<T extends TabKey> = Components<T, LinkTabListItemProps<T>>;

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

type SelectionProps<T extends TabKey> =
  | {onChange: (key: NoInfer<T>) => void; value: T; defaultValue?: never}
  | {defaultValue: NoInfer<T>; onChange?: (key: T) => void; value?: never};

export type TabsProps<T extends TabKey = TabKey> = BaseTabsProps &
  SelectionProps<T> & {
    children: (components: TabsComponents<NoInfer<T>>) => ReactNode;
    disabledKeys?: Iterable<NoInfer<T>>;
  };

export type LinkTabsProps<T extends TabKey = TabKey> = Omit<
  BaseTabsProps,
  'keyboardActivation'
> & {
  children: (components: LinkTabsComponents<NoInfer<T>>) => ReactNode;
  value: T;
  defaultValue?: never;
  disabledKeys?: Iterable<NoInfer<T>>;
  /** Reports link activation, including modified clicks, rather than selection or URL changes. */
  onChange?: (key: NoInfer<T>) => void;
};

export type InternalTabsProps = BaseTabsProps & {children: ReactNode} & (
    | ({kind: 'selection'} & SelectionProps<TabKey>)
    | {
        kind: 'links';
        value: TabKey;
        defaultValue?: never;
        onChange?: (key: TabKey) => void;
      }
  );

function TabStateProvider({
  children,
  orientation = 'horizontal',
  size = 'md',
  ...props
}: InternalTabsProps) {
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
}: InternalTabsProps) {
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
        {children}
      </Flex>
    </TabStateProvider>
  );
}

// Bind the key type without wrapping the collection items or changing their identity.
function SelectionTabsRoot({children, ...props}: TabsProps) {
  return (
    <TabsRoot kind="selection" {...props}>
      {children(components)}
    </TabsRoot>
  );
}

function LinkTabsRoot({children, ...props}: LinkTabsProps) {
  return (
    <TabsRoot kind="links" {...props}>
      {children(components)}
    </TabsRoot>
  );
}

export const Tabs = SelectionTabsRoot as <T extends TabKey = TabKey>(
  props: TabsProps<T>
) => JSX.Element;
export const LinkTabs = LinkTabsRoot as <T extends TabKey = TabKey>(
  props: LinkTabsProps<T>
) => JSX.Element;

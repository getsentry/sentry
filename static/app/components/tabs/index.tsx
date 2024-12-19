import 'intersection-observer'; // polyfill

import {createContext, useState} from 'react';
import styled from '@emotion/styled';
import type {AriaTabListOptions} from '@react-aria/tabs';
import type {TabListState, TabListStateOptions} from '@react-stately/tabs';
import type {Orientation} from '@react-types/shared';

import {tabsShouldForwardProp} from './utils';

export {TabList, type TabListProps} from './tabList';
export {TabPanels} from './tabPanels';

export interface TabsProps<T>
  extends Omit<
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
  children?: React.ReactNode;
  className?: string;
  /**
   * [Uncontrolled] Default selected tab. Must match the `key` prop on the
   * selected tab item.
   */
  defaultValue?: T;
  /**
   * Disable tabs from being put in the overflow menu.
   */
  disableOverflow?: boolean;
  disabled?: boolean;
  /**
   * Callback when the selected tab changes.
   */
  onChange?: (key: T) => void;
  /**
   * [Controlled] Selected tab . Must match the `key` prop on the selected tab
   * item.
   */
  value?: T;
}

export interface TabContext {
  rootProps: Omit<TabsProps<any>, 'children' | 'className'>;
  setTabListState: (state: TabListState<any>) => void;
  tabListState?: TabListState<any>;
}

export const TabsContext = createContext<TabContext>({
  rootProps: {orientation: 'horizontal'},
  setTabListState: () => {},
});

export function TabStateProvider<T extends string | number>({
  children,
  ...props
}: Omit<TabsProps<T>, 'className'>) {
  const [tabListState, setTabListState] = useState<TabListState<any>>();

  return (
    <TabsContext.Provider
      value={{
        rootProps: {...props, orientation: 'horizontal'},
        tabListState,
        setTabListState,
      }}
    >
      {children}
    </TabsContext.Provider>
  );
}

/**
 * Root tabs component. Provides the necessary data (via React context) for
 * child components (TabList and TabPanels) to work together. See example
 * usage in tabs.stories.js
 */
export function Tabs<T extends string | number>({
  orientation = 'horizontal',
  className,
  children,
  ...props
}: TabsProps<T>) {
  return (
    <TabStateProvider orientation={orientation} {...props}>
      <TabsWrap orientation={orientation} className={className}>
        {children}
      </TabsWrap>
    </TabStateProvider>
  );
}

const TabsWrap = styled('div', {shouldForwardProp: tabsShouldForwardProp})<{
  orientation: Orientation;
}>`
  display: flex;
  flex-direction: ${p => (p.orientation === 'horizontal' ? 'column' : 'row')};
  flex-grow: 1;

  ${p =>
    p.orientation === 'vertical' &&
    `
      height: 100%;
      align-items: stretch;
    `};
`;

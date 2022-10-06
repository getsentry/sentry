import 'intersection-observer'; // polyfill

import {createContext, useState} from 'react';
import styled from '@emotion/styled';
import {AriaTabListProps} from '@react-aria/tabs';
import {Item} from '@react-stately/collections';
import {TabListProps, TabListState} from '@react-stately/tabs';
import {ItemProps, Orientation} from '@react-types/shared';

import {TabList} from './tabList';
import {TabPanels} from './tabPanels';
import {tabsShouldForwardProp} from './utils';

const _Item = Item as (
  props: ItemProps<any> & {disabled?: boolean; hidden?: boolean}
) => JSX.Element;
export {_Item as Item, TabList, TabPanels};

export interface TabsProps<T>
  extends Omit<TabListProps<any>, 'children'>,
    Omit<AriaTabListProps<any>, 'children'> {
  children?: React.ReactNode;
  className?: string;
  /**
   * [Uncontrolled] Default selected tab. Must match the `key` prop on the
   * selected tab item.
   */
  defaultValue?: T;
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

interface TabContext {
  rootProps: TabsProps<any> & {orientation: Orientation};
  setTabListState: (state: TabListState<any>) => void;
  tabListState?: TabListState<any>;
}

export const TabsContext = createContext<TabContext>({
  rootProps: {orientation: 'horizontal', children: []},
  setTabListState: () => {},
});

/**
 * Root tabs component. Provides the necessary data (via React context) for
 * child components (TabList and TabPanels) to work together. See example
 * usage in tabs.stories.js
 */
export function Tabs<T extends React.Key>({
  orientation = 'horizontal',
  className,
  ...props
}: TabsProps<T>) {
  const [tabListState, setTabListState] = useState<TabListState<any>>();

  return (
    <TabsContext.Provider
      value={{rootProps: {...props, orientation}, tabListState, setTabListState}}
    >
      <TabsWrap orientation={orientation} className={className}>
        {props.children}
      </TabsWrap>
    </TabsContext.Provider>
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

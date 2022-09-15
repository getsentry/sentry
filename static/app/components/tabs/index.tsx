import 'intersection-observer'; // polyfill

import {createContext, useState} from 'react';
import styled from '@emotion/styled';
import {AriaTabListProps} from '@react-aria/tabs';
import {Item} from '@react-stately/collections';
import {TabListProps, TabListState} from '@react-stately/tabs';
import {ItemProps, Orientation} from '@react-types/shared';

import {TabList} from './tabList';
import {TabPanels} from './tabPanels';

const _Item = Item as <T>(props: ItemProps<T> & {disabled?: boolean}) => JSX.Element;
export {_Item as Item, TabList, TabPanels};

export interface TabsProps<T> extends TabListProps<T>, AriaTabListProps<T> {
  className?: string;
  disabled?: boolean;
}

interface TabContext<T> {
  rootProps: TabsProps<T> & {orientation: Orientation};
  setTabListState: (state: TabListState<T>) => void;
  tabListState?: TabListState<T>;
}

export const TabsContext = createContext<TabContext<any>>({
  rootProps: {orientation: 'horizontal', children: []},
  setTabListState: () => {},
});

/**
 * Root tabs component. Provides the necessary data (via React context) for
 * child components (TabList and TabPanels) to work together. See example
 * usage in tabs.stories.js
 */
export function Tabs<T extends object>({
  orientation = 'horizontal',
  className,
  ...props
}: TabsProps<T>) {
  const [tabListState, setTabListState] = useState<TabListState<T>>();

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

const TabsWrap = styled('div')<{orientation: Orientation}>`
  display: flex;
  flex-direction: ${p => (p.orientation === 'horizontal' ? 'column' : 'row')};

  ${p =>
    p.orientation === 'horizontal'
      ? `
        flex-direction: column;
      `
      : `
        height: 100%;
        flex-direction: row;
        align-items: stretch;
      `};
`;

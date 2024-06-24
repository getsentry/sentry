import 'intersection-observer'; // polyfill

import {createContext, useState} from 'react';
import styled from '@emotion/styled';
import type {AriaTabListOptions} from '@react-aria/tabs';
import type {TabListState, TabListStateOptions} from '@react-stately/tabs';
import type {Key, Orientation} from '@react-types/shared';

import {DraggableTabList} from 'sentry/components/draggableTabs/draggableTabList';
import {DraggableTabPanels} from 'sentry/components/draggableTabs/draggableTabPanels';

import {tabsShouldForwardProp} from './utils';

export interface DraggableTabsProps<T>
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

interface DraggableTabContext {
  rootProps: Omit<DraggableTabsProps<any>, 'children' | 'className'>;
  setTabListState: (state: TabListState<any>) => void;
  tabListState?: TabListState<any>;
}

export const TabsContext = createContext<DraggableTabContext>({
  rootProps: {orientation: 'horizontal'},
  setTabListState: () => {},
});

/**
 * Root tabs component. Provides the necessary data (via React context) for
 * child components (TabList and TabPanels) to work together. See example
 * usage in tabs.stories.js
 */
export function DraggableTabs<T extends string | number>({
  orientation = 'horizontal',
  className,
  children,
  ...props
}: DraggableTabsProps<T>) {
  const [tabListState, setTabListState] = useState<TabListState<any>>();

  return (
    <TabsContext.Provider
      value={{rootProps: {...props, orientation}, tabListState, setTabListState}}
    >
      <TabsWrap orientation={orientation} className={className}>
        {children}
      </TabsWrap>
    </TabsContext.Provider>
  );
}

export interface Tab {
  content: React.ReactNode;
  key: Key;
  label: string;
}

export interface DragAndDropTabBarProps {
  tabs: Tab[];
}

export function DraggableTabBar(props: DragAndDropTabBarProps) {
  const [tabs, setTabs] = useState<Tab[]>(props.tabs);

  return (
    <DraggableTabs>
      <DraggableTabList tabs={tabs} setTabs={setTabs}>
        {tabs.map(tab => (
          <DraggableTabList.Item key={tab.key}>{tab.label}</DraggableTabList.Item>
        ))}
      </DraggableTabList>
      <DraggableTabPanels>
        {tabs.map(tab => (
          <DraggableTabPanels.Item key={tab.key}>{tab.content}</DraggableTabPanels.Item>
        ))}
      </DraggableTabPanels>
    </DraggableTabs>
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

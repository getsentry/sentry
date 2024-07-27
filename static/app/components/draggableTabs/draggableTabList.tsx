import {useContext, useEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import type {AriaTabListOptions} from '@react-aria/tabs';
import {useTabList} from '@react-aria/tabs';
import {useCollection} from '@react-stately/collections';
import {ListCollection} from '@react-stately/list';
import type {TabListStateOptions} from '@react-stately/tabs';
import {useTabListState} from '@react-stately/tabs';
import type {Node, Orientation} from '@react-types/shared';
import {Reorder} from 'framer-motion';

import type {SelectOption} from 'sentry/components/compactSelect';
import {TabsContext} from 'sentry/components/tabs';
import {OverflowMenu, useOverflowTabs} from 'sentry/components/tabs/tabList';
import {tabsShouldForwardProp} from 'sentry/components/tabs/utils';
import {space} from 'sentry/styles/space';
import {browserHistory} from 'sentry/utils/browserHistory';

import {DraggableTab} from './draggableTab';
import type {DraggableTabListItemProps} from './item';
import {Item} from './item';

interface BaseDraggableTabListProps extends DraggableTabListProps {
  items: DraggableTabListItemProps[];
}

function BaseDraggableTabList({
  hideBorder = false,
  className,
  outerWrapStyles,
  onReorder,
  ...props
}: BaseDraggableTabListProps) {
  const tabListRef = useRef<HTMLUListElement>(null);
  const {rootProps, setTabListState} = useContext(TabsContext);
  const {
    value,
    defaultValue,
    onChange,
    disabled,
    orientation = 'horizontal',
    keyboardActivation = 'manual',
    ...otherRootProps
  } = rootProps;

  // Load up list state
  const ariaProps = {
    selectedKey: value,
    defaultSelectedKey: defaultValue,
    onSelectionChange: key => {
      onChange?.(key);

      // If the newly selected tab is a tab link, then navigate to the specified link
      const linkTo = [...(props.items ?? [])].find(item => item.key === key)?.to;
      if (!linkTo) {
        return;
      }
      browserHistory.push(linkTo);
    },
    isDisabled: disabled,
    keyboardActivation,
    ...otherRootProps,
    ...props,
  };

  const state = useTabListState(ariaProps);

  const {tabListProps} = useTabList({orientation, ...ariaProps}, state, tabListRef);
  useEffect(() => {
    setTabListState(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.disabledKeys, state.selectedItem, state.selectedKey, props.children]);

  // Detect tabs that overflow from the wrapper and put them in an overflow menu
  const tabItemsRef = useRef<Record<string | number, HTMLLIElement | null>>({});
  const overflowTabs = useOverflowTabs({
    tabListRef,
    tabItemsRef,
    tabItems: props.items,
  });

  const overflowMenuItems = useMemo(() => {
    // Sort overflow items in the order that they appear in TabList
    const sortedKeys = [...state.collection].map(item => item.key);
    const sortedOverflowTabs = overflowTabs.sort(
      (a, b) => sortedKeys.indexOf(a) - sortedKeys.indexOf(b)
    );

    return sortedOverflowTabs.flatMap<SelectOption<string | number>>(key => {
      const item = state.collection.getItem(key);

      if (!item) {
        return [];
      }

      return {
        value: key,
        label: item.props.children,
        disabled: item.props.disabled,
        textValue: item.textValue,
      };
    });
  }, [state.collection, overflowTabs]);

  return (
    <TabListOuterWrap style={outerWrapStyles}>
      <Reorder.Group
        axis="x"
        values={[...state.collection]}
        onReorder={onReorder}
        as="div"
      >
        <TabListWrap
          {...tabListProps}
          orientation={orientation}
          hideBorder={hideBorder}
          className={className}
          ref={tabListRef}
        >
          {[...state.collection].map(item => (
            <Reorder.Item
              key={item.key}
              value={item}
              style={{display: 'flex', flexDirection: 'row'}}
            >
              <DraggableTab
                key={item.key}
                item={item}
                state={state}
                orientation={orientation}
                overflowing={
                  orientation === 'horizontal' && overflowTabs.includes(item.key)
                }
                ref={element => (tabItemsRef.current[item.key] = element)}
              />
              {state.selectedKey !== item.key &&
                state.collection.getKeyAfter(item.key) !== state.selectedKey && (
                  <TabDivider />
                )}
            </Reorder.Item>
          ))}
        </TabListWrap>
      </Reorder.Group>

      {orientation === 'horizontal' && overflowMenuItems.length > 0 && (
        <OverflowMenu
          state={state}
          overflowMenuItems={overflowMenuItems}
          disabled={disabled}
        />
      )}
    </TabListOuterWrap>
  );
}

const collectionFactory = (nodes: Iterable<Node<any>>) => new ListCollection(nodes);

export interface DraggableTabListProps
  extends AriaTabListOptions<DraggableTabListItemProps>,
    TabListStateOptions<DraggableTabListItemProps> {
  onReorder: (newOrder: Node<DraggableTabListItemProps>[]) => void;
  className?: string;
  hideBorder?: boolean;
  outerWrapStyles?: React.CSSProperties;
}

/**
 * To be used as a direct child of the <Tabs /> component. See example usage
 * in tabs.stories.js
 */
export function DraggableTabList({items, ...props}: DraggableTabListProps) {
  const collection = useCollection({items, ...props}, collectionFactory);

  const parsedItems = useMemo(
    () => [...collection].map(({key, props: itemProps}) => ({key, ...itemProps})),
    [collection]
  );

  /**
   * List of keys of disabled items (those with a `disbled` prop) to be passed
   * into `BaseTabList`.
   */
  const disabledKeys = useMemo(
    () => parsedItems.filter(item => item.disabled).map(item => item.key),
    [parsedItems]
  );

  return (
    <BaseDraggableTabList items={parsedItems} disabledKeys={disabledKeys} {...props}>
      {item => <Item {...item} />}
    </BaseDraggableTabList>
  );
}

DraggableTabList.Item = Item;

const TabDivider = styled('div')`
  height: 50%;
  width: 1px;
  border-radius: 6px;
  background-color: ${p => p.theme.gray200};
  margin: 8px auto;
`;

const TabListOuterWrap = styled('div')`
  position: relative;
`;

const TabListWrap = styled('ul', {
  shouldForwardProp: tabsShouldForwardProp,
})<{
  hideBorder: boolean;
  orientation: Orientation;
}>`
  position: relative;
  display: grid;
  padding: 0;
  margin: 0;
  list-style-type: none;
  flex-shrink: 0;
  padding-left: 15px;

  ${p =>
    p.orientation === 'horizontal'
      ? `
        grid-auto-flow: column;
        justify-content: start;
        ${!p.hideBorder && `border-bottom: solid 1px ${p.theme.border};`}
        stroke-dasharray: 4, 3;
      `
      : `
        height: 100%;
        grid-auto-flow: row;
        align-content: start;
        gap: 1px;
        padding-right: ${space(2)};
        ${!p.hideBorder && `border-right: solid 1px ${p.theme.border};`}
      `};
`;

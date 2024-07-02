import {useContext, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {ListDropTargetDelegate, useDroppableCollection} from '@react-aria/dnd';
import {ListKeyboardDelegate} from '@react-aria/selection';
import type {AriaTabListOptions} from '@react-aria/tabs';
import {useTabList} from '@react-aria/tabs';
import {mergeProps} from '@react-aria/utils';
import {useCollection} from '@react-stately/collections';
import {
  type DroppableCollectionStateOptions,
  useDroppableCollectionState,
} from '@react-stately/dnd';
import {ListCollection} from '@react-stately/list';
import type {TabListStateOptions} from '@react-stately/tabs';
import {useTabListState} from '@react-stately/tabs';
import type {
  DroppableCollectionInsertDropEvent,
  Node,
  Orientation,
  TextDropItem,
} from '@react-types/shared';
import {Reorder} from 'framer-motion';

import {Button} from 'sentry/components/button';
import type {SelectOption} from 'sentry/components/compactSelect';
import type {Tab} from 'sentry/components/draggableTabs';
import {TabsContext} from 'sentry/components/tabs';
import {OverflowMenu, useOverflowTabs} from 'sentry/components/tabs/tabList';
import {IconAdd} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {browserHistory} from 'sentry/utils/browserHistory';

import {DraggableTab} from './draggableTab';
import type {DraggableTabListItemProps} from './item';
import {Item} from './item';
import {tabsShouldForwardProp} from './utils';

interface BaseDraggableTabListProps extends DraggableTabListProps {
  items: DraggableTabListItemProps[];
  setTabs: (tabs: Tab[]) => void;
  tabs: Tab[];
}

function BaseDraggableTabList({
  hideBorder = false,
  className,
  outerWrapStyles,
  tabs,
  setTabs,
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
  const [isTempTabVisible, setIsTempTabVisible] = useState<boolean>(false);

  const {tabListProps} = useTabList({orientation, ...ariaProps}, state, tabListRef);
  useEffect(() => {
    setTabListState(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.disabledKeys, state.selectedItem, state.selectedKey, props.children]);

  const dropState = useDroppableCollectionState({
    ...props,
    collection: state.collection,
    selectionManager: state.selectionManager,
  });

  const {collectionProps} = useDroppableCollection(
    {
      ...props,
      // Provide drop targets for keyboard and pointer-based drag and drop.
      keyboardDelegate: new ListKeyboardDelegate(
        state.collection,
        state.disabledKeys,
        tabListRef
      ),
      dropTargetDelegate: new ListDropTargetDelegate(state.collection, tabListRef),
    },
    dropState,
    tabListRef
  );

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

  const persistentTabs = [...state.collection].filter(
    item => item.key !== 'temporary-tab'
  );
  const tempTab = [...state.collection].find(item => item.key === 'temporary-tab');

  return (
    <TabListOuterWrap style={outerWrapStyles}>
      <Reorder.Group axis="x" values={tabs} onReorder={setTabs} as="div">
        <TabListWrap
          {...mergeProps(tabListProps, collectionProps)}
          tempViewSelected={state.selectedKey === state.collection.getLastKey()}
          orientation={orientation}
          hideBorder={hideBorder}
          className={className}
          ref={tabListRef}
        >
          {persistentTabs.map(item => (
            <Reorder.Item
              key={item.key}
              value={tabs.find(tab => tab.key === item.key)}
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
                dropState={dropState}
                onDelete={() => {
                  setTabs(tabs.filter(tab => tab.key !== item.key));
                }}
                ref={element => (tabItemsRef.current[item.key] = element)}
                isChanged
              />
              {state.selectedKey !== item.key &&
                state.collection.getKeyAfter(item.key) !== state.selectedKey && (
                  <TabDivider />
                )}
            </Reorder.Item>
          ))}
          <AddViewButton borderless size="zero" onClick={() => setIsTempTabVisible(true)}>
            <IconAdd size="xs" style={{margin: '2 4 2 2'}} />
            Add View
          </AddViewButton>
          {isTempTabVisible && <TabDivider />}
          {isTempTabVisible && tempTab && (
            <DraggableTab
              key={tempTab.key}
              item={tempTab}
              state={state}
              orientation={orientation}
              overflowing={false}
              dropState={dropState}
              onDelete={() => setIsTempTabVisible(false)}
              ref={element => (tabItemsRef.current[tempTab.key] = element)}
              isChanged
              isTempTab
            />
          )}
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
    TabListStateOptions<DraggableTabListItemProps>,
    Omit<DroppableCollectionStateOptions, 'collection' | 'selectionManager'> {
  setTabs: (tabs: Tab[]) => void;
  tabs: Tab[];
  className?: string;
  hideBorder?: boolean;
  outerWrapStyles?: React.CSSProperties;
}

/**
 * To be used as a direct child of the <Tabs /> component. See example usage
 * in tabs.stories.js
 */
export function DraggableTabList({
  items,
  tabs,
  setTabs,
  ...props
}: DraggableTabListProps) {
  const onInsert = async (e: DroppableCollectionInsertDropEvent) => {
    const dropItem = e.items[0] as TextDropItem;
    const eventTab: {key: string; value: string} = JSON.parse(
      await dropItem.getText('tab')
    );
    const draggedTab = tabs.find(tab => tab.key === eventTab.key);
    if (!draggedTab || e.target.key === draggedTab.key) {
      return; // Do nothing if the dragged tab is dropped on itself
    }

    const updatedTabs = tabs.filter(tab => tab.key !== draggedTab.key);
    const targetIdx = updatedTabs.findIndex(tab => tab.key === e.target.key);
    if (targetIdx > -1) {
      if (e.target.dropPosition === 'before') {
        updatedTabs.splice(targetIdx, 0, draggedTab);
      } else if (e.target.dropPosition === 'after') {
        updatedTabs.splice(targetIdx + 1, 0, draggedTab);
      }
      setTabs(updatedTabs);
    }
  };

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
    <BaseDraggableTabList
      tabs={tabs}
      onInsert={onInsert}
      items={parsedItems}
      disabledKeys={disabledKeys}
      setTabs={setTabs}
      {...props}
    >
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
  margin: 9px auto;
`;

const AddViewButton = styled(Button)`
  color: ${p => p.theme.gray300};
  padding-right: ${space(0.5)};
  margin-top: 3px;
  font-weight: normal;
`;

const TabListOuterWrap = styled('div')`
  position: relative;
`;

const TabListWrap = styled('ul', {
  shouldForwardProp: tabsShouldForwardProp,
})<{
  hideBorder: boolean;
  orientation: Orientation;
  tempViewSelected: boolean;
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
        gap: ${space(0.5)};
        ${!p.hideBorder && `border-bottom: ${p.tempViewSelected ? `dashed 1px` : `solid 1px`} ${p.theme.border};`}
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

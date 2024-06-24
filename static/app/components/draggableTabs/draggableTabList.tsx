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

import type {SelectOption} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
import {type Tab, TabsContext} from 'sentry/components/draggableTabs';
import DropdownButton from 'sentry/components/dropdownButton';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {browserHistory} from 'sentry/utils/browserHistory';

import {DraggableTab} from './draggableTab';
import type {DraggableTabListItemProps} from './item';
import {Item} from './item';
import {tabsShouldForwardProp} from './utils';

/**
 * Uses IntersectionObserver API to detect overflowing tabs. Returns an array
 * containing of keys of overflowing tabs.
 */
function useOverflowTabs({
  tabListRef,
  tabItemsRef,
  tabItems,
}: {
  tabItems: DraggableTabListItemProps[];
  tabItemsRef: React.RefObject<Record<string | number, HTMLLIElement | null>>;
  tabListRef: React.RefObject<HTMLUListElement>;
}) {
  const [overflowTabs, setOverflowTabs] = useState<Array<string | number>>([]);

  useEffect(() => {
    const options = {
      root: tabListRef.current,
      // Nagative right margin to account for overflow menu's trigger button
      rootMargin: `0px -42px 1px ${space(1)}`,
      // Use 0.95 rather than 1 because of a bug in Edge (Windows) where the intersection
      // ratio may unexpectedly drop to slightly below 1 (0.999…) on page scroll.
      threshold: 0.95,
    };

    const callback: IntersectionObserverCallback = entries => {
      entries.forEach(entry => {
        const {target} = entry;
        const {key} = (target as HTMLElement).dataset;
        if (!key) {
          return;
        }

        if (!entry.isIntersecting) {
          setOverflowTabs(prev => prev.concat([key]));
          return;
        }

        setOverflowTabs(prev => prev.filter(k => k !== key));
      });
    };

    const observer = new IntersectionObserver(callback, options);
    Object.values(tabItemsRef.current ?? {}).forEach(
      element => element && observer.observe(element)
    );

    return () => observer.disconnect();
  }, [tabListRef, tabItemsRef]);

  const tabItemKeyToHiddenMap = tabItems.reduce(
    (acc, next) => ({
      ...acc,
      [next.key]: next.hidden,
    }),
    {}
  );

  // Tabs that are hidden will be rendered with display: none so won't intersect,
  // but we don't want to show them in the overflow menu
  return overflowTabs.filter(tabKey => !tabItemKeyToHiddenMap[tabKey]);
}

interface BaseDraggableTabListProps extends DraggableTabListProps {
  items: DraggableTabListItemProps[];
}

function BaseDraggableTabList({
  hideBorder = false,
  className,
  outerWrapStyles,
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

  return (
    <TabListOuterWrap style={outerWrapStyles}>
      <TabListWrap
        {...mergeProps(tabListProps, collectionProps)}
        orientation={orientation}
        hideBorder={hideBorder}
        className={className}
        ref={tabListRef}
      >
        {[...state.collection].map(item => (
          <DraggableTab
            key={item.key}
            item={item}
            state={state}
            orientation={orientation}
            overflowing={orientation === 'horizontal' && overflowTabs.includes(item.key)}
            dropState={dropState}
            ref={element => (tabItemsRef.current[item.key] = element)}
          />
        ))}
      </TabListWrap>

      {orientation === 'horizontal' && overflowMenuItems.length > 0 && (
        <TabListOverflowWrap>
          <CompactSelect
            options={overflowMenuItems}
            value={[...state.selectionManager.selectedKeys][0]}
            onChange={opt => state.setSelectedKey(opt.value)}
            disabled={disabled}
            position="bottom-end"
            size="sm"
            offset={4}
            trigger={triggerProps => (
              <OverflowMenuTrigger
                {...triggerProps}
                size="sm"
                borderless
                showChevron={false}
                icon={<IconEllipsis />}
                aria-label={t('More tabs')}
              />
            )}
          />
        </TabListOverflowWrap>
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
    const eventTab = JSON.parse(await dropItem.getText('tab'));
    const draggedTab = tabs.find(tab => tab.key === eventTab.key);

    if (draggedTab) {
      const updatedTabs = tabs.filter(tab => tab.key !== draggedTab.key);
      const targetTab = tabs.find(tab => tab.key === e.target.key);
      if (targetTab) {
        const targetIdx = updatedTabs.indexOf(targetTab);
        if (targetTab && e.target.dropPosition === 'before') {
          updatedTabs.splice(targetIdx, 0, draggedTab);
        } else if (targetTab && e.target.dropPosition === 'after') {
          updatedTabs.splice(targetIdx + 1, 0, draggedTab);
        }
        setTabs(updatedTabs);
      }
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

const TabListOuterWrap = styled('div')`
  position: relative;
`;

const TabListWrap = styled('ul', {shouldForwardProp: tabsShouldForwardProp})<{
  hideBorder: boolean;
  orientation: Orientation;
}>`
  position: relative;
  display: grid;
  padding: 0;
  margin: 0;
  list-style-type: none;
  flex-shrink: 0;

  ${p =>
    p.orientation === 'horizontal'
      ? `
        grid-auto-flow: column;
        justify-content: start;
        gap: ${space(2)};
        ${!p.hideBorder && `border-bottom: solid 1px ${p.theme.border};`}
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

const TabListOverflowWrap = styled('div')`
  position: absolute;
  right: 0;
  bottom: ${space(0.75)};
`;
const OverflowMenuTrigger = styled(DropdownButton)`
  padding-left: ${space(1)};
  padding-right: ${space(1)};
`;

import {Fragment, useContext, useEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import type {AriaTabListOptions} from '@react-aria/tabs';
import {useTabList} from '@react-aria/tabs';
import {useCollection} from '@react-stately/collections';
import {ListCollection} from '@react-stately/list';
import type {TabListStateOptions} from '@react-stately/tabs';
import {useTabListState} from '@react-stately/tabs';
import type {Node, Orientation} from '@react-types/shared';
import {Reorder} from 'framer-motion';

import {Button} from 'sentry/components/button';
import type {SelectOption} from 'sentry/components/compactSelect';
import {TabsContext} from 'sentry/components/tabs';
import {type BaseTabProps, Tab} from 'sentry/components/tabs/tab';
import {OverflowMenu, useOverflowTabs} from 'sentry/components/tabs/tabList';
import {tabsShouldForwardProp} from 'sentry/components/tabs/utils';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {browserHistory} from 'sentry/utils/browserHistory';

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
  onAddView,
  showTempTab = false,
  tabVariant = 'filled',
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

  const persistentTabs = [...state.collection].filter(
    item => item.key !== 'temporary-tab'
  );
  const tempTab = [...state.collection].find(item => item.key === 'temporary-tab');

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
          borderStyle={state.selectedKey === 'temporary-tab' ? 'dashed' : 'solid'}
          className={className}
          ref={tabListRef}
        >
          {persistentTabs.map(item => (
            <Fragment key={item.key}>
              <Reorder.Item
                key={item.key}
                value={item}
                style={{display: 'flex', flexDirection: 'row'}}
                as="div"
              >
                <Tab
                  key={item.key}
                  item={item}
                  state={state}
                  orientation={orientation}
                  overflowing={
                    orientation === 'horizontal' && overflowTabs.includes(item.key)
                  }
                  ref={element => (tabItemsRef.current[item.key] = element)}
                  variant={tabVariant}
                />
              </Reorder.Item>
              {(state.selectedKey === 'temporary-tab' ||
                (state.selectedKey !== item.key &&
                  state.collection.getKeyAfter(item.key) !== state.selectedKey)) && (
                <TabDivider />
              )}
            </Fragment>
          ))}
          <AddViewButton borderless size="zero" onClick={onAddView}>
            <StyledIconAdd size="xs" />
            {t('Add View')}
          </AddViewButton>
          <TabDivider />
          {showTempTab && tempTab && (
            <Tab
              key={tempTab.key}
              item={tempTab}
              state={state}
              orientation={orientation}
              overflowing={
                orientation === 'horizontal' && overflowTabs.includes(tempTab.key)
              }
              ref={element => (tabItemsRef.current[tempTab.key] = element)}
              variant={tabVariant}
              borderStyle="dashed"
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
    TabListStateOptions<DraggableTabListItemProps> {
  onReorder: (newOrder: Node<DraggableTabListItemProps>[]) => void;
  className?: string;
  hideBorder?: boolean;
  onAddView?: React.MouseEventHandler;
  outerWrapStyles?: React.CSSProperties;
  showTempTab?: boolean;
  tabVariant?: BaseTabProps['variant'];
}

/**
 * To be used as a direct child of the <Tabs /> component. See example usage
 * in tabs.stories.js
 */
export function DraggableTabList({
  items,
  onAddView,
  showTempTab,
  ...props
}: DraggableTabListProps) {
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
      items={parsedItems}
      onAddView={onAddView}
      showTempTab={showTempTab}
      disabledKeys={disabledKeys}
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
  margin: 8px 4px;
`;

const TabListOuterWrap = styled('div')`
  position: relative;
`;

const TabListWrap = styled('ul', {
  shouldForwardProp: tabsShouldForwardProp,
})<{
  borderStyle: 'dashed' | 'solid';
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
        ${!p.hideBorder && `border-bottom: ${p.borderStyle} 1px ${p.theme.border};`}
        stroke-dasharray: 4, 3;
      `
      : `
        height: 100%;
        grid-auto-flow: row;
        align-content: start;
        gap: 1px;
        padding-right: ${space(2)};
        ${!p.hideBorder && `border-right: ${p.borderStyle} 1px ${p.theme.border};`}
      `};
`;

const AddViewButton = styled(Button)`
  color: ${p => p.theme.gray300};
  padding-right: ${space(0.5)};
  margin: 3px 2px 2px 2px;
  font-weight: normal;
`;

const StyledIconAdd = styled(IconAdd)`
  margin-right: 4px;
  margin-left: 2px;
`;

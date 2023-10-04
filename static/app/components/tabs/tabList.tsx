import {useContext, useEffect, useMemo, useRef, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {AriaTabListOptions, useTabList} from '@react-aria/tabs';
import {useCollection} from '@react-stately/collections';
import {ListCollection} from '@react-stately/list';
import {TabListStateOptions, useTabListState} from '@react-stately/tabs';
import {Node, Orientation} from '@react-types/shared';

import {CompactSelect, SelectOption} from 'sentry/components/compactSelect';
import DropdownButton from 'sentry/components/dropdownButton';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import {TabsContext} from './index';
import {Item, TabListItemProps} from './item';
import {Tab} from './tab';
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
  tabItems: TabListItemProps[];
  tabItemsRef: React.RefObject<Record<React.Key, HTMLLIElement | null>>;
  tabListRef: React.RefObject<HTMLUListElement>;
}) {
  const [overflowTabs, setOverflowTabs] = useState<React.Key[]>([]);

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

export interface TabListProps
  extends AriaTabListOptions<TabListItemProps>,
    TabListStateOptions<TabListItemProps> {
  className?: string;
  hideBorder?: boolean;
  outerWrapStyles?: React.CSSProperties;
}

interface BaseTabListProps extends TabListProps {
  items: TabListItemProps[];
}

function BaseTabList({
  hideBorder = false,
  className,
  outerWrapStyles,
  ...props
}: BaseTabListProps) {
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
  const tabItemsRef = useRef<Record<React.Key, HTMLLIElement | null>>({});
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

    return sortedOverflowTabs.flatMap<SelectOption<React.Key>>(key => {
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
        {...tabListProps}
        orientation={orientation}
        hideBorder={hideBorder}
        className={className}
        ref={tabListRef}
      >
        {[...state.collection].map(item => (
          <Tab
            key={item.key}
            item={item}
            state={state}
            orientation={orientation}
            overflowing={orientation === 'horizontal' && overflowTabs.includes(item.key)}
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

/**
 * To be used as a direct child of the <Tabs /> component. See example usage
 * in tabs.stories.js
 */
export function TabList({items, ...props}: TabListProps) {
  /**
   * Initial, unfiltered list of tab items.
   */
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
    <BaseTabList items={parsedItems} disabledKeys={disabledKeys} {...props}>
      {item => <Item {...item} />}
    </BaseTabList>
  );
}

TabList.Item = Item;

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

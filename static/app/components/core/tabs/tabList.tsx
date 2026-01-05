import {useContext, useEffect, useMemo, useRef, useState} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {AriaTabListOptions} from '@react-aria/tabs';
import {useTabList} from '@react-aria/tabs';
import {useCollection} from '@react-stately/collections';
import {ListCollection} from '@react-stately/list';
import type {TabListStateOptions} from '@react-stately/tabs';
import {useTabListState} from '@react-stately/tabs';
import type {Node, Orientation} from '@react-types/shared';

import {SelectTrigger} from '@sentry/scraps/compactSelect/trigger';

import type {SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useNavigate} from 'sentry/utils/useNavigate';

import type {TabListItemProps} from './item';
import {TabListItem} from './item';
import {Tab} from './tab';
import type {BaseTabProps} from './tab';
import {TabsContext} from './tabs';
import {tabsShouldForwardProp} from './utils';

const StyledTabListWrap = styled('ul', {
  shouldForwardProp: tabsShouldForwardProp,
})<{
  orientation: Orientation;
  variant: BaseTabProps['variant'];
}>`
  position: relative;
  display: grid;
  padding: 0;
  margin: 0;
  list-style-type: none;
  flex-shrink: 0;
  gap: ${p => p.theme.space.xs};

  ${p =>
    p.orientation === 'horizontal'
      ? css`
          grid-auto-flow: column;
          justify-content: start;
        `
      : css`
          height: 100%;
          grid-auto-flow: row;
          align-content: start;
          padding-right: ${space(0.5)};
        `};
`;

const StyledTabListOverflowWrap = styled('div')`
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: ${p => p.theme.zIndex.dropdown};
`;

/**
 * Uses IntersectionObserver API to detect overflowing tabs. Returns an array
 * containing of keys of overflowing tabs.
 */
function useOverflowTabs({
  tabListRef,
  tabItemsRef,
  tabItems,
  disabled,
}: {
  /**
   * Prevent tabs from being put in the overflow menu.
   */
  disabled: boolean | undefined;
  tabItems: TabListItemProps[];
  tabItemsRef: React.RefObject<Record<string | number, HTMLLIElement | null>>;
  tabListRef: React.RefObject<HTMLUListElement | null>;
}) {
  const [overflowTabs, setOverflowTabs] = useState<Array<string | number>>([]);
  const theme = useTheme();

  useEffect(() => {
    if (disabled) {
      return () => {};
    }

    const options = {
      root: tabListRef.current,
      // Negative right margin to account for overflow menu's trigger button
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

    return () => {
      observer.disconnect();
      setOverflowTabs([]);
    };
  }, [tabListRef, tabItemsRef, disabled, theme]);

  const tabItemKeyToHiddenMap = tabItems.reduce<Record<string | number, boolean>>(
    (acc, next) => ({
      ...acc,
      [next.key]: !!next.hidden,
    }),
    {}
  );

  // Tabs that are hidden will be rendered with display: none so won't intersect,
  // but we don't want to show them in the overflow menu
  return overflowTabs.filter(tabKey => !tabItemKeyToHiddenMap[tabKey]);
}

function OverflowMenu({state, overflowMenuItems, disabled}: any) {
  return (
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
            borderless
            icon={<IconEllipsis />}
            aria-label={t('More tabs')}
          />
        )}
      />
    </TabListOverflowWrap>
  );
}

export interface TabListProps {
  children: TabListStateOptions<TabListItemProps>['children'];
  outerWrapStyles?: React.CSSProperties;
  variant?: BaseTabProps['variant'];
}

interface BaseTabListProps extends AriaTabListOptions<TabListItemProps>, TabListProps {
  items: TabListItemProps[];
  variant?: BaseTabProps['variant'];
}

function BaseTabList({outerWrapStyles, variant = 'flat', ...props}: BaseTabListProps) {
  const navigate = useNavigate();
  const tabListRef = useRef<HTMLUListElement>(null);
  const {rootProps, setTabListState} = useContext(TabsContext);
  const {
    value,
    defaultValue,
    onChange,
    disabled,
    orientation,
    size,
    keyboardActivation = 'manual',
    disableOverflow,
    ...otherRootProps
  } = rootProps;

  // Load up list state
  const ariaProps = {
    selectedKey: value,
    defaultSelectedKey: defaultValue,
    onSelectionChange: (key: any) => {
      onChange?.(key);

      // If the newly selected tab is a tab link, then navigate to the specified link
      const linkTo = [...(props.items ?? [])].find(item => item.key === key)?.to;
      if (!linkTo) {
        return;
      }
      navigate(linkTo);
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
    disabled: disableOverflow,
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
        tooltip: item.props.tooltip,
        textValue: item.textValue,
      };
    });
  }, [state.collection, overflowTabs]);

  return (
    <TabListOuterWrap style={outerWrapStyles}>
      <TabListWrap
        {...tabListProps}
        orientation={orientation}
        ref={tabListRef}
        variant={variant}
      >
        {[...state.collection].map(item => (
          <Tab
            key={item.key}
            item={item}
            state={state}
            orientation={orientation}
            size={size}
            overflowing={orientation === 'horizontal' && overflowTabs.includes(item.key)}
            tooltipProps={item.props.tooltip}
            ref={element => {
              tabItemsRef.current[item.key] = element;
            }}
            variant={variant}
          />
        ))}
      </TabListWrap>

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

const collectionFactory = (nodes: Iterable<Node<TabListItemProps>>) =>
  new ListCollection(nodes);

/**
 * To be used as a direct child of the `<Tabs />` component. See example usage
 * in tabs.stories.js
 */
export function TabList({variant, ...props}: TabListProps) {
  /**
   * Initial, unfiltered list of tab items.
   */
  const collection = useCollection(props, collectionFactory);

  const parsedItems: TabListItemProps[] = useMemo(
    () => [...collection].map(({key, props: itemProps}) => ({key, ...itemProps})),
    [collection]
  );

  /**
   * List of keys of disabled items (those with a `disabled` prop) to be passed
   * into `BaseTabList`.
   */
  const disabledKeys = useMemo(
    () => parsedItems.filter(item => item.disabled).map(item => item.key),
    [parsedItems]
  );

  return (
    <BaseTabList
      {...props}
      items={parsedItems}
      disabledKeys={disabledKeys}
      variant={variant}
    >
      {item => <TabListItem {...item} key={item.key} />}
    </BaseTabList>
  );
}

TabList.Item = TabListItem;

const TabListOuterWrap = styled('div')`
  position: relative;
`;

const TabListWrap = StyledTabListWrap;

const TabListOverflowWrap = StyledTabListOverflowWrap;

const OverflowMenuTrigger = styled(SelectTrigger.IconButton)`
  padding-left: ${space(1)};
  padding-right: ${space(1)};
  color: ${p => p.theme.tokens.component.link.muted.default};
`;

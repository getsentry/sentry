import {
  useContext,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import type {AriaTabListOptions} from '@react-aria/tabs';
import {useTabList} from '@react-aria/tabs';
import {useCollection} from '@react-stately/collections';
import {ListCollection} from '@react-stately/list';
import type {TabListState, TabListStateOptions} from '@react-stately/tabs';
import {useTabListState} from '@react-stately/tabs';
import type {Node, Orientation} from '@react-types/shared';

import type {SelectOption} from '@sentry/scraps/compactSelect';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useNavigate} from 'sentry/utils/useNavigate';

import type {TabListItemProps} from './item';
import {TabListItem} from './item';
import {Tab} from './tab';
import type {TabProps} from './tab';
import {TabsContext} from './tabs';
import {tabsShouldForwardProp} from './utils';

const StyledTabListWrap = styled('ul', {
  shouldForwardProp: tabsShouldForwardProp,
})<{
  orientation: Orientation;
  variant: TabProps['variant'];
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
          padding-right: ${p.theme.space.xs};
        `}
`;

const StyledTabListOverflowWrap = styled('div')`
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: ${p => p.theme.zIndex.dropdown};
`;

/**
 * Width (px) reserved on the right edge for the overflow menu trigger button.
 * Kept slightly larger than the actual button so the trigger never overlaps
 * the last visible tab.
 */
const RESERVED_OVERFLOW_TRIGGER_WIDTH = 48;

/**
 * Measures the tab list against the space available in its container and
 * returns the keys of the tabs that don't fit, as a contiguous suffix. Those
 * tabs are visually hidden (see `Tab`) and surfaced through an overflow menu.
 *
 * This uses direct measurement rather than an IntersectionObserver on purpose:
 * the result is deterministic, so for a given container width the same set of
 * tabs always overflows. That avoids the inconsistent states the observer-based
 * approach could settle into while resizing — tabs from the middle of the list
 * disappearing, the trigger overlapping a tab, or no overflow being detected at
 * all when the list was momentarily allowed to grow to its content width.
 */
function useOverflowTabs({
  outerWrapRef,
  tabListRef,
  tabItemsRef,
  tabItems,
  disabled,
}: {
  /**
   * Prevent tabs from being put in the overflow menu.
   */
  disabled: boolean | undefined;
  /**
   * The relatively-positioned wrapper around the list. Its width is the space
   * available to the tabs and is unaffected by the list overflowing.
   */
  outerWrapRef: React.RefObject<HTMLDivElement | null>;
  tabItems: TabListItemProps[];
  tabItemsRef: React.RefObject<Record<string | number, HTMLLIElement | null>>;
  tabListRef: React.RefObject<HTMLUListElement | null>;
}) {
  const [overflowTabs, setOverflowTabs] = useState<Array<string | number>>([]);
  // Cached intrinsic widths per tab key. Overflowing tabs render with
  // `display: none` and measure 0, so we remember their last measured width to
  // know when they would fit again as space grows.
  const tabWidthsRef = useRef(new Map<string | number, number>());

  // Measures the list against the available space and updates the overflow set.
  const recompute = useEffectEvent(() => {
    if (disabled) {
      setOverflowTabs(prev => (prev.length === 0 ? prev : []));
      return;
    }

    const outerWrap = outerWrapRef.current;
    const tabList = tabListRef.current;
    if (!outerWrap || !tabList) {
      return;
    }

    const elements = tabItemsRef.current ?? {};
    const gap = parseFloat(getComputedStyle(tabList).columnGap) || 0;

    // Tabs that participate in the layout, in render (visual) order. Tabs with
    // the `hidden` prop render with `display: none` and take up no space.
    const keys = tabItems.filter(item => !item.hidden).map(item => item.key);

    // Refresh the cached width of every measurable (currently visible) tab.
    // Overflowing tabs measure 0; their last known width is kept.
    for (const key of keys) {
      const measured = elements[key]?.getBoundingClientRect().width ?? 0;
      if (measured > 0) {
        tabWidthsRef.current.set(key, measured);
      }
    }

    const available = outerWrap.clientWidth;

    // Width required to render every tab, without reserving the trigger.
    const fullWidth = keys.reduce(
      (sum: number, key, index) =>
        sum + (tabWidthsRef.current.get(key) ?? 0) + (index === 0 ? 0 : gap),
      0
    );

    let nextOverflow: Array<string | number>;
    if (fullWidth <= available) {
      nextOverflow = [];
    } else {
      // Overflow is needed, so leave room for the trigger button.
      const budget = available - RESERVED_OVERFLOW_TRIGGER_WIDTH;
      nextOverflow = [];
      let used = 0;
      let isOverflowing = false;
      keys.forEach((key, index) => {
        if (isOverflowing) {
          nextOverflow.push(key);
          return;
        }
        const nextUsed =
          used + (tabWidthsRef.current.get(key) ?? 0) + (index === 0 ? 0 : gap);
        // Always keep the first tab to avoid an empty tab bar.
        if (index === 0 || nextUsed <= budget) {
          used = nextUsed;
        } else {
          isOverflowing = true;
          nextOverflow.push(key);
        }
      });
    }

    // Bail out when the result is unchanged to avoid re-render churn (and any
    // observer feedback from hiding/showing tabs).
    setOverflowTabs(prev =>
      prev.length === nextOverflow.length &&
      prev.every((key, index) => key === nextOverflow[index])
        ? prev
        : nextOverflow
    );
  });

  // Recompute whenever an input that affects the overflow result changes: the
  // disabled state, or the set/order/hidden-state of the tabs. Width changes are
  // handled by the ResizeObserver below; a reorder can leave the total width
  // unchanged, so the observer alone wouldn't catch it.
  const recomputeSignature = [
    disabled ? 'disabled' : 'enabled',
    ...tabItems.map(item => `${item.key}:${item.hidden ? 1 : 0}`),
  ].join('|');

  useLayoutEffect(() => {
    recompute();
  }, [recomputeSignature]);

  // Recompute on container resize (available space changes) and on list resize
  // (tabs added/removed/relabeled change its intrinsic width). Keyed only on the
  useEffect(() => {
    if (disabled) {
      return;
    }

    const outerWrap = outerWrapRef.current;
    const tabList = tabListRef.current;
    if (!outerWrap || !tabList) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => recompute());
    resizeObserver.observe(outerWrap);
    resizeObserver.observe(tabList);

    return () => resizeObserver.disconnect();
  }, [disabled, outerWrapRef, tabListRef]);

  // Tabs with the `hidden` prop render with display: none; never surface them
  // in the overflow menu.
  const hiddenKeys = new Set(tabItems.filter(item => item.hidden).map(item => item.key));
  return overflowTabs.filter(key => !hiddenKeys.has(key));
}

interface OverflowMenuProps {
  disabled: boolean | undefined;
  overflowMenuItems: Array<SelectOption<string | number>>;
  state: TabListState<TabListItemProps>;
}

function OverflowMenu({state, overflowMenuItems, disabled}: OverflowMenuProps) {
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
            variant="transparent"
            icon={<IconEllipsis />}
            aria-label={t('More tabs')}
          />
        )}
      />
    </TabListOverflowWrap>
  );
}

interface TabListProps {
  children: TabListStateOptions<TabListItemProps>['children'];
  outerWrapStyles?: React.CSSProperties;
  variant?: TabProps['variant'];
}

interface BaseTabListProps extends AriaTabListOptions<TabListItemProps>, TabListProps {
  items: TabListItemProps[];
  variant?: TabProps['variant'];
}

function BaseTabList({outerWrapStyles, variant = 'flat', ...props}: BaseTabListProps) {
  const navigate = useNavigate();
  const outerWrapRef = useRef<HTMLDivElement>(null);
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
    outerWrapRef,
    tabListRef,
    tabItemsRef,
    tabItems: props.items,
    // Overflow only applies to horizontal tab lists.
    disabled: disableOverflow || orientation !== 'horizontal',
  });

  const overflowMenuItems = useMemo(() => {
    // Sort overflow items in the order that they appear in TabList
    const sortedKeys = [...state.collection].map(item => item.key);
    const sortedOverflowTabs = overflowTabs.toSorted(
      (a, b) => sortedKeys.indexOf(a) - sortedKeys.indexOf(b)
    );

    return sortedOverflowTabs.flatMap(key => {
      const item = state.collection.getItem(key);

      if (!item) {
        return [];
      }

      const itemProps: TabListItemProps = item.props;

      return {
        value: key,
        label: itemProps.children,
        disabled: itemProps.disabled,
        tooltip: itemProps.tooltip?.title,
        tooltipOptions: itemProps.tooltip,
        textValue: item.textValue,
      } satisfies SelectOption<string | number>;
    });
  }, [state.collection, overflowTabs]);

  return (
    <Container position="relative" style={outerWrapStyles} ref={outerWrapRef}>
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
            tooltipProps={(item.props as TabListItemProps).tooltip}
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
    </Container>
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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

const TabListWrap = StyledTabListWrap;

const TabListOverflowWrap = StyledTabListOverflowWrap;

const OverflowMenuTrigger = styled(OverlayTrigger.IconButton)`
  padding-left: ${p => p.theme.space.md};
  padding-right: ${p => p.theme.space.md};
  color: ${p => p.theme.tokens.interactive.link.neutral.rest};
`;

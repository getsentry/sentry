import type {RefObject, CSSProperties} from 'react';
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
import type {TabListStateOptions} from '@react-stately/tabs';
import {useTabListState} from '@react-stately/tabs';
import type {Key, Node, Orientation} from '@react-types/shared';
import {IconEllipsis} from '@sentry/icons/ellipsis';

import {DropdownMenu, type MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {Container, Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {useTranslation} from '@sentry/scraps/translation/useTranslation';

import {TabsContext} from './context';
import {fitTabs, type TabFit} from './fitTabs';
import type {InternalTabListItemProps} from './item';
import {TabListItem} from './item';
import {Tab} from './tab';
import type {TabProps} from './tab';
import {tabsShouldForwardProp} from './utils';

const StyledTabListWrap = styled('ul', {shouldForwardProp: tabsShouldForwardProp})<{
  orientation: Orientation;
  overflowing: boolean;
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

  /* Overflowing tabs keep their place in the layout, so clip them to keep them
     from adding scrollable overflow. */
  ${p =>
    p.overflowing &&
    css`
      overflow-x: clip;
    `}
`;

/**
 * Measures the tab list against the space available in its container and
 * returns the tabs that don't fit and where to place the overflow trigger.
 * Overflowing tabs are visually hidden (see `Tab`) and surfaced through an
 * overflow menu.
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
  outerWrapRef: RefObject<HTMLDivElement | null>;
  tabItems: InternalTabListItemProps[];
  tabItemsRef: RefObject<Record<string | number, HTMLLIElement | null>>;
  tabListRef: RefObject<HTMLUListElement | null>;
}) {
  const [fit, setFit] = useState<TabFit | null>(null);

  // Tabs that participate in the layout, in render (visual) order. Tabs with
  // the `hidden` prop render with `display: none` and take up no space.
  const layoutKeys: Array<string | number> = tabItems
    .filter(item => !item.hidden)
    .map(item => item.key);

  // Measures the list against the available space and updates the fit.
  const recompute = useEffectEvent(() => {
    if (disabled) {
      setFit(null);
      return;
    }

    const outerWrap = outerWrapRef.current;
    const tabList = tabListRef.current;
    if (!outerWrap || !tabList) {
      return;
    }

    // Overflowing tabs are only visually hidden (see `Tab`), so every tab still
    // measures its full width.
    const widths = layoutKeys.map(
      key => tabItemsRef.current[key]?.getBoundingClientRect().width ?? 0
    );
    const next = fitTabs(
      widths,
      parseFloat(getComputedStyle(tabList).columnGap) || 0,
      outerWrap.getBoundingClientRect().width
    );

    // Bail out when the result is unchanged to avoid re-render churn (and any
    // observer feedback from hiding/showing tabs).
    setFit(prev =>
      prev?.visibleCount === next.visibleCount &&
      prev.triggerOffset === next.triggerOffset
        ? prev
        : next
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
    // oxlint-disable-next-line react/set-state-in-effect
    recompute();
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [recomputeSignature]);

  // Recompute on container resize (available space changes) and on list resize
  // (tabs added/removed/relabeled change its intrinsic width). Keyed only on the
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (disabled) {
      return;
    }

    const outerWrap = outerWrapRef.current;
    const tabList = tabListRef.current;
    if (!outerWrap || !tabList) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      // Defer recompute to outside the render/layout phase. In Firefox,
      // ResizeObserver callbacks can fire synchronously during rendering,
      // which throws when calling a useEffectEvent-wrapped function.
      rafRef.current = requestAnimationFrame(() => recompute());
    });
    resizeObserver.observe(outerWrap);
    resizeObserver.observe(tabList);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [disabled, outerWrapRef, tabListRef]);

  return {
    overflowTabs: fit ? layoutKeys.slice(fit.visibleCount) : [],
    triggerOffset: fit?.triggerOffset ?? 0,
  };
}

interface OverflowMenuProps {
  disabled: boolean | undefined;
  overflowMenuItems: MenuItemProps[];
  triggerOffset: number;
}

function OverflowMenu({overflowMenuItems, disabled, triggerOffset}: OverflowMenuProps) {
  const {t} = useTranslation();

  return (
    <Flex
      position="absolute"
      top="0"
      bottom="0"
      left={`${triggerOffset}px`}
      align="center"
    >
      <DropdownMenu
        items={overflowMenuItems}
        isDisabled={disabled}
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
    </Flex>
  );
}

export interface TabListProps {
  children: TabListStateOptions<InternalTabListItemProps>['children'];
  className?: string;
  outerWrapStyles?: CSSProperties;
  variant?: TabProps['variant'];
}

interface BaseTabListProps
  extends AriaTabListOptions<InternalTabListItemProps>, TabListProps {
  items: InternalTabListItemProps[];
  variant?: TabProps['variant'];
}

function BaseTabList({
  className,
  outerWrapStyles,
  variant = 'flat',
  ...props
}: BaseTabListProps) {
  const outerWrapRef = useRef<HTMLDivElement>(null);
  const tabListRef = useRef<HTMLUListElement>(null);
  const {rootProps, setTabListState} = useContext(TabsContext);
  const {
    value,
    defaultValue,
    onChange,
    onSelectionChange,
    disabled,
    orientation,
    size,
    keyboardActivation = 'manual',
    ...otherRootProps
  } = rootProps;

  // Load up list state
  const ariaProps = {
    selectedKey: value,
    defaultSelectedKey: defaultValue,
    onSelectionChange: (key: Key) => onSelectionChange?.(String(key)),
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
  const {overflowTabs, triggerOffset} = useOverflowTabs({
    outerWrapRef,
    tabListRef,
    tabItemsRef,
    tabItems: props.items,
    // Overflow only applies to horizontal tab lists.
    disabled: orientation !== 'horizontal',
  });

  const overflowMenuItems = useMemo(() => {
    // Sort overflow items in the order that they appear in TabList
    const sortedKeys = Array.from(state.collection, item => item.key);
    const sortedOverflowTabs = overflowTabs.toSorted(
      (a, b) => sortedKeys.indexOf(a) - sortedKeys.indexOf(b)
    );

    return sortedOverflowTabs.flatMap(key => {
      const item = state.collection.getItem(key);

      if (!item) {
        return [];
      }

      const itemProps: InternalTabListItemProps = item.props;

      return {
        key: String(key),
        to: itemProps.to,
        isSelected: state.selectedKey === key,
        onAction:
          itemProps.to === undefined
            ? () => state.setSelectedKey(key)
            : () => onChange?.(String(key)),
        label: (
          <Flex align="center" gap="md">
            {itemProps.children}
          </Flex>
        ),
        disabled: itemProps.disabled,
        tooltip: itemProps.tooltip?.title,
        tooltipOptions: itemProps.tooltip,
        textValue: item.textValue,
      } satisfies MenuItemProps;
    });
  }, [state, overflowTabs, onChange]);

  return (
    <Container
      position="relative"
      className={className}
      style={outerWrapStyles}
      ref={outerWrapRef}
    >
      <TabListWrap
        {...tabListProps}
        orientation={orientation}
        overflowing={overflowTabs.length > 0}
        ref={tabListRef}
        variant={variant}
      >
        {Array.from(state.collection, item => (
          <Tab
            key={item.key}
            item={item}
            state={state}
            orientation={orientation}
            size={size}
            overflowing={orientation === 'horizontal' && overflowTabs.includes(item.key)}
            tooltipProps={(item.props as InternalTabListItemProps).tooltip}
            ref={element => {
              tabItemsRef.current[item.key] = element;
            }}
            variant={variant}
          />
        ))}
      </TabListWrap>

      {orientation === 'horizontal' && overflowMenuItems.length > 0 && (
        <OverflowMenu
          overflowMenuItems={overflowMenuItems}
          disabled={disabled}
          triggerOffset={triggerOffset}
        />
      )}
    </Container>
  );
}

const collectionFactory = (nodes: Iterable<Node<InternalTabListItemProps>>) =>
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

  const parsedItems: InternalTabListItemProps[] = useMemo(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    () => Array.from(collection, ({key, props: itemProps}) => ({key, ...itemProps})),
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

const OverflowMenuTrigger = styled(OverlayTrigger.IconButton)`
  padding-left: ${p => p.theme.space.md};
  padding-right: ${p => p.theme.space.md};
  color: ${p => p.theme.tokens.interactive.link.neutral.rest};
`;

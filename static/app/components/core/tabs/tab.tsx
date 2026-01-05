import styled from '@emotion/styled';
import type {AriaTabProps} from '@react-aria/tabs';
import {useTab} from '@react-aria/tabs';
import {useObjectRef} from '@react-aria/utils';
import type {TabListState} from '@react-stately/tabs';
import type {Node, Orientation} from '@react-types/shared';

import {Link} from 'sentry/components/core/link';
import {Tooltip, type TooltipProps} from 'sentry/components/core/tooltip';

import type {BaseTabProps} from './tab.chonk';
import {
  chonkInnerWrapStyles,
  ChonkStyledTabSelectionIndicator,
  ChonkStyledTabWrap,
} from './tab.chonk';

interface TabProps extends AriaTabProps {
  item: Node<any>;
  orientation: Orientation;
  /**
   * Whether this tab is overflowing the TabList container. If so, the tab
   * needs to be visually hidden. Users can instead select it via an overflow
   * menu.
   */
  overflowing: boolean;
  size: BaseTabProps['size'];
  state: TabListState<any>;
  as?: React.ElementType;
  ref?: React.Ref<HTMLLIElement>;
  tooltipProps?: TooltipProps;
  variant?: BaseTabProps['variant'];
}

/**
 * Stops event propagation if the command/ctrl/shift key is pressed, in effect
 * preventing any state change. This is useful because when a user
 * command/ctrl/shift-clicks on a tab link, the intention is to view the tab
 * in a new browser tab/window, not to update the current view.
 */
function handleLinkClick(e: React.PointerEvent<HTMLAnchorElement>) {
  if (e.metaKey || e.ctrlKey || e.shiftKey) {
    e.stopPropagation();
  }
}

function InnerWrap({
  children,
  to,
  disabled,
  ...props
}: Pick<BaseTabProps, 'children' | 'to' | 'orientation' | 'disabled' | 'size'> & {
  selected: boolean;
  variant: NonNullable<BaseTabProps['variant']>;
}) {
  return to && !disabled ? (
    <TabLink
      to={to}
      onMouseDown={handleLinkClick}
      onPointerDown={handleLinkClick}
      tabIndex={-1}
      {...props}
    >
      {children}
    </TabLink>
  ) : (
    <TabInnerWrap {...props}>{children}</TabInnerWrap>
  );
}

function BaseTab({
  to,
  children,
  ref,
  orientation,
  overflowing,
  tabProps,
  hidden,
  disabled,
  isSelected,
  size,
  variant = 'flat',
  as = 'li',
}: BaseTabProps) {
  return (
    <TabWrap
      {...tabProps}
      hidden={hidden}
      selected={isSelected}
      overflowing={overflowing}
      ref={ref}
      as={as}
    >
      <InnerWrap
        to={to}
        orientation={orientation}
        disabled={disabled}
        variant={variant}
        selected={isSelected}
        size={size}
      >
        {children}
        {variant === 'flat' ? (
          <TabSelectionIndicator orientation={orientation} selected={isSelected} />
        ) : null}
      </InnerWrap>
    </TabWrap>
  );
}

/**
 * Renders a single tab item. This should not be imported directly into any
 * page/view – it's only meant to be used by <TabsList />. See the correct
 * usage in tabs.stories.js
 */
export function Tab({
  ref,
  item,
  state,
  orientation,
  overflowing,
  variant,
  size,
  as = 'li',
  tooltipProps,
}: TabProps) {
  const objectRef = useObjectRef(ref);

  const {
    key,
    rendered,
    props: {to, hidden, disabled},
  } = item;

  const {tabProps, isSelected} = useTab({key, isDisabled: hidden}, state, objectRef);

  if (tooltipProps) {
    return (
      <Tooltip {...tooltipProps}>
        <BaseTab
          tabProps={tabProps}
          isSelected={isSelected}
          to={to}
          hidden={hidden}
          disabled={disabled}
          orientation={orientation}
          overflowing={overflowing}
          ref={objectRef}
          variant={variant}
          as={as}
          size={size}
        >
          {rendered}
        </BaseTab>
      </Tooltip>
    );
  }

  return (
    <BaseTab
      tabProps={tabProps}
      isSelected={isSelected}
      to={to}
      hidden={hidden}
      disabled={disabled}
      orientation={orientation}
      overflowing={overflowing}
      ref={objectRef}
      variant={variant}
      as={as}
      size={size}
    >
      {rendered}
    </BaseTab>
  );
}

const TabWrap = ChonkStyledTabWrap;

const TabLink = styled(Link)<{
  orientation: Orientation;
  selected: boolean;
  size: BaseTabProps['size'];
  variant: BaseTabProps['variant'];
}>`
  ${p =>
    chonkInnerWrapStyles({
      variant: p.variant,
      selected: p.selected,
      orientation: p.orientation,
      theme: p.theme,
      size: p.size,
    })}

  &,
  &:hover {
    color: inherit;
  }
`;

const TabInnerWrap = styled('span')<{
  orientation: Orientation;
  selected: boolean;
  size: BaseTabProps['size'];
  variant: BaseTabProps['variant'];
}>`
  ${p =>
    chonkInnerWrapStyles({
      variant: p.variant,
      selected: p.selected,
      orientation: p.orientation,
      size: p.size,
      theme: p.theme,
    })}
`;

const TabSelectionIndicator = ChonkStyledTabSelectionIndicator;

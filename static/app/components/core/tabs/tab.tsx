import {css} from '@emotion/react';
import styled from '@emotion/styled';
import type {AriaTabProps} from '@react-aria/tabs';
import {useTab} from '@react-aria/tabs';
import {useObjectRef} from '@react-aria/utils';
import type {TabListState} from '@react-stately/tabs';
import type {DOMAttributes, Node, Orientation} from '@react-types/shared';

import {Link} from 'sentry/components/core/link';
import {Tooltip, type TooltipProps} from 'sentry/components/core/tooltip';
import type {Theme} from 'sentry/utils/theme';

import {tabsShouldForwardProp} from './utils';

export interface BaseTabProps {
  children: React.ReactNode;
  disabled: boolean;
  hidden: boolean;
  isSelected: boolean;
  orientation: Orientation;
  overflowing: boolean;
  size: 'md' | 'sm' | 'xs';
  tabProps: DOMAttributes;
  as?: React.ElementType;
  ref?: React.Ref<HTMLLIElement>;
  to?: string;
  variant?: 'flat' | 'floating';
}

const StyledTabWrap = styled('li', {
  shouldForwardProp: tabsShouldForwardProp,
})<{
  overflowing: boolean;
  selected: boolean;
}>`
  color: ${p =>
    p.selected
      ? p.theme.tokens.component.link.accent.default
      : p.theme.tokens.component.link.muted.default};
  white-space: nowrap;
  cursor: pointer;

  &:focus-visible {
    outline: none;
  }

  &[aria-disabled] {
    opacity: ${p => (p.overflowing ? 0 : 0.6)};
    cursor: default;
  }

  ${p =>
    p.overflowing &&
    css`
      opacity: 0;
      pointer-events: none;
    `}
`;

const paddingPerSize = (theme: Theme, orientation: Orientation) => ({
  md: orientation === 'horizontal' ? `10px ${theme.space.xl}` : `10px ${theme.space.md}`,
  sm:
    orientation === 'horizontal'
      ? `${theme.space.md} ${theme.space.lg}`
      : `${theme.space.md} ${theme.space.sm}`,
  xs:
    orientation === 'horizontal'
      ? `${theme.space.sm} ${theme.space.md}`
      : `${theme.space.sm} ${theme.space.xs}`,
});

const selectionIndicatorSize = '2px';

const innerWrapStyles = ({
  theme,
  orientation,
  variant,
  size,
  selected,
}: {
  orientation: Orientation;
  selected: boolean;
  size: BaseTabProps['size'];
  theme: Theme;
  variant: BaseTabProps['variant'];
}) => css`
  display: flex;
  align-items: center;
  position: relative;
  height: ${theme.form[size].height};
  min-height: ${theme.form[size].minHeight};
  font-size: ${theme.form[size].fontSize};
  line-height: ${theme.form[size].lineHeight};
  padding: ${paddingPerSize(theme, orientation)[size]};
  border-radius: ${theme.radius.md};
  transform: translateY(1px);
  margin-bottom: ${orientation === 'horizontal' && variant === 'flat'
    ? theme.space.xs
    : 0};

  ${orientation === 'horizontal'
    ? css`
        gap: ${theme.space.md};
      `
    : css`
        gap: ${theme.space.sm};
        /**
          * To align the SelectionIndicator (2px width, 4px spacing)
          */
        margin-left: ${variant === 'flat'
          ? `calc(${theme.space.xs} + ${selectionIndicatorSize})`
          : 0};
        /* static padding towards SelectionIndicator */
        padding-left: ${theme.space.md};
      `};

  li[aria-disabled]:hover & {
    background-color: transparent;
  }

  li:focus-visible & {
    outline: none;
    box-shadow: inset 0 0 0 2px ${theme.focusBorder};
  }

  li:not([aria-disabled]):hover & {
    background-color: ${selected
      ? variant === 'floating'
        ? theme.colors.blue200
        : theme.colors.blue100
      : theme.colors.gray100};
    color: ${selected
      ? theme.tokens.component.link.accent.hover
      : theme.tokens.component.link.muted.hover};
  }

  li:not([aria-disabled]):active & {
    background-color: ${selected
      ? variant === 'floating'
        ? theme.colors.blue300
        : theme.colors.blue200
      : theme.colors.gray200};
    color: ${selected
      ? theme.tokens.component.link.accent.active
      : theme.tokens.component.link.muted.active};
  }

  ${variant === 'floating' &&
  selected &&
  css`
    background-color: ${theme.colors.blue100};
  `}
`;

const StyledTabSelectionIndicator = styled('div')<{
  orientation: Orientation;
  selected: boolean;
}>`
  position: absolute;
  border-radius: 1px;
  pointer-events: none;
  background: ${p => (p.selected ? p.theme.colors.blue400 : 'transparent')};

  li[aria-disabled] & {
    opacity: 0.6;
  }

  ${p =>
    p.orientation === 'horizontal'
      ? css`
          width: 100%;
          height: ${selectionIndicatorSize};

          bottom: 0;
          left: 50%;
          transform: translate(-50%, ${p.theme.space.xs});
        `
      : css`
          width: ${selectionIndicatorSize};
          height: 50%;

          left: -6px;
          top: 50%;
          transform: translateY(-50%);
        `};
`;

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
          <StyledTabSelectionIndicator orientation={orientation} selected={isSelected} />
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

const TabWrap = StyledTabWrap;

const TabLink = styled(Link)<{
  orientation: Orientation;
  selected: boolean;
  size: BaseTabProps['size'];
  variant: BaseTabProps['variant'];
}>`
  ${p =>
    innerWrapStyles({
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
    innerWrapStyles({
      variant: p.variant,
      selected: p.selected,
      orientation: p.orientation,
      size: p.size,
      theme: p.theme,
    })}
`;

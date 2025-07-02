import {Fragment} from 'react';
import {css, type Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {AriaTabProps} from '@react-aria/tabs';
import {useTab} from '@react-aria/tabs';
import {useObjectRef} from '@react-aria/utils';
import type {TabListState} from '@react-stately/tabs';
import type {Node, Orientation} from '@react-types/shared';

import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Link} from 'sentry/components/core/link';
import {space} from 'sentry/styles/space';
import {isChonkTheme, withChonk} from 'sentry/utils/theme/withChonk';

import type {BaseTabProps} from './tab.chonk';
import {
  chonkInnerWrapStyles,
  ChonkStyledTabSelectionIndicator,
  ChonkStyledTabWrap,
} from './tab.chonk';
import {tabsShouldForwardProp} from './utils';

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
  const theme = useTheme();
  if (variant === 'floating' && !theme.isChonk) {
    return (
      <FloatingTabWrap
        {...tabProps}
        hidden={hidden}
        overflowing={overflowing}
        ref={ref}
        as={as}
      >
        <VariantStyledInteractionStateLayer hasSelectedBackground={false} />
        <VariantFocusLayer />
        {children}
      </FloatingTabWrap>
    );
  }

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
        {!theme.isChonk && (
          <Fragment>
            <StyledInteractionStateLayer
              orientation={orientation}
              higherOpacity={isSelected}
            />
            <FocusLayer
              orientation={orientation}
              variant={variant}
              selected={isSelected}
            />
          </Fragment>
        )}
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
}: TabProps) {
  const objectRef = useObjectRef(ref);

  const {
    key,
    rendered,
    props: {to, hidden, disabled},
  } = item;

  const {tabProps, isSelected} = useTab({key, isDisabled: hidden}, state, objectRef);

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
const FloatingTabWrap = styled('li', {shouldForwardProp: tabsShouldForwardProp})<{
  overflowing: boolean;
}>`
  &[aria-selected='true'] {
    ${p => css`
      color: ${p.theme.purple400};
      font-weight: ${p.theme.fontWeight.bold};
      background-color: ${p.theme.purple100};
    `}
  }
  &[aria-selected='false'] {
    border-top: 1px solid transparent;
  }
  color: ${p => p.theme.subText};
  border-radius: 6px;
  padding: ${space(0.5)} ${space(1)};
  transform: translateY(1px);
  cursor: pointer;
  &:focus {
    outline: none;
  }
  ${p =>
    p.overflowing &&
    css`
      opacity: 0;
      pointer-events: none;
    `}
`;

const TabWrap = withChonk(
  styled('li', {shouldForwardProp: tabsShouldForwardProp})<{
    overflowing: boolean;
    selected: boolean;
  }>`
    color: ${p => (p.selected ? p.theme.activeText : p.theme.textColor)};
    white-space: nowrap;
    cursor: pointer;

    &:hover {
      color: ${p => (p.selected ? p.theme.activeText : p.theme.headingColor)};
    }

    &:focus {
      outline: none;
    }

    &[aria-disabled],
    &[aria-disabled]:hover {
      color: ${p => p.theme.subText};
      pointer-events: none;
      cursor: default;
    }

    ${p =>
      p.overflowing &&
      css`
        opacity: 0;
        pointer-events: none;
      `}
  `,
  ChonkStyledTabWrap
);

const innerWrapStyles = ({
  theme,
  orientation,
}: {
  orientation: Orientation;
  theme: Theme;
}) => css`
  display: flex;
  align-items: center;
  position: relative;
  height: calc(
    ${theme.form.sm.height} + ${orientation === 'horizontal' ? space(0.75) : '0px'}
  );
  border-radius: ${theme.borderRadius};
  transform: translateY(1px);

  ${orientation === 'horizontal'
    ? css`
        /* Extra padding + negative margin trick, to expand click area */
        padding: ${space(0.75)} ${space(1)} ${space(1.5)};
        margin-left: -${space(1)};
        margin-right: -${space(1)};
      `
    : css`
        padding: ${space(0.75)} ${space(2)};
      `};
`;

const TabLink = styled(Link)<{
  orientation: Orientation;
  selected: boolean;
  size: BaseTabProps['size'];
  variant: BaseTabProps['variant'];
}>`
  ${p =>
    isChonkTheme(p.theme)
      ? chonkInnerWrapStyles({
          variant: p.variant,
          selected: p.selected,
          orientation: p.orientation,
          theme: p.theme,
          size: p.size,
        })
      : innerWrapStyles(p)}

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
    isChonkTheme(p.theme)
      ? chonkInnerWrapStyles({
          variant: p.variant,
          selected: p.selected,
          orientation: p.orientation,
          size: p.size,
          theme: p.theme,
        })
      : innerWrapStyles(p)}
`;

const StyledInteractionStateLayer = styled(InteractionStateLayer)<{
  orientation: Orientation;
}>`
  position: absolute;
  width: auto;
  height: auto;
  transform: none;
  left: 0;
  right: 0;
  top: 0;
  bottom: ${p => (p.orientation === 'horizontal' ? space(0.75) : 0)};
`;

const VariantStyledInteractionStateLayer = styled(InteractionStateLayer)`
  position: absolute;
  width: auto;
  height: auto;
  transform: none;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
`;

const FocusLayer = styled('div')<{
  orientation: Orientation;
  selected: boolean;
  variant: BaseTabProps['variant'];
}>`
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: ${p => (p.orientation === 'horizontal' ? space(0.75) : 0)};

  pointer-events: none;
  border-radius: inherit;
  z-index: 0;
  transition: box-shadow 0.1s ease-out;

  li:focus-visible & {
    box-shadow:
      ${p => p.theme.focusBorder} 0 0 0 1px,
      inset ${p => p.theme.focusBorder} 0 0 0 1px;
  }
`;

const VariantFocusLayer = styled('div')`
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;

  pointer-events: none;
  border-radius: inherit;
  z-index: 0;
  transition: box-shadow 0.1s ease-out;

  li:focus-visible & {
    box-shadow:
      ${p => p.theme.focusBorder} 0 0 0 1px,
      inset ${p => p.theme.focusBorder} 0 0 0 1px;
  }
`;

const TabSelectionIndicator = withChonk(
  styled('div')<{
    orientation: Orientation;
    selected: boolean;
  }>`
    position: absolute;
    border-radius: 2px;
    pointer-events: none;
    background: ${p => (p.selected ? p.theme.active : 'transparent')};
    transition: background 0.1s ease-out;

    li[aria-disabled='true'] & {
      background: ${p => (p.selected ? p.theme.subText : 'transparent')};
    }

    ${p =>
      p.orientation === 'horizontal'
        ? css`
            width: calc(100% - ${space(2)});
            height: 3px;

            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
          `
        : css`
            width: 3px;
            height: 50%;

            left: 0;
            top: 50%;
            transform: translateY(-50%);
          `};
  `,
  ChonkStyledTabSelectionIndicator
);

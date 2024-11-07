import {forwardRef, useCallback} from 'react';
import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {AriaTabProps} from '@react-aria/tabs';
import {useTab} from '@react-aria/tabs';
import {useObjectRef} from '@react-aria/utils';
import type {TabListState} from '@react-stately/tabs';
import type {
  DOMAttributes,
  FocusableElement,
  Node,
  Orientation,
} from '@react-types/shared';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import Link from 'sentry/components/links/link';
import {space} from 'sentry/styles/space';

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
  state: TabListState<any>;
  as?: React.ElementType;
  borderStyle?: BaseTabProps['borderStyle'];
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

export interface BaseTabProps {
  children: React.ReactNode;
  hidden: boolean;
  isSelected: boolean;
  orientation: Orientation;
  overflowing: boolean;
  tabProps: DOMAttributes<FocusableElement>;
  as?: React.ElementType;
  /**
   * This controls the border style of the tab. Only active when
   * `variant='filled'` since other variants do not have a border
   */
  borderStyle?: 'solid' | 'dashed';
  to?: string;
  variant?: 'flat' | 'filled' | 'floating';
}

export const BaseTab = forwardRef(
  (props: BaseTabProps, forwardedRef: React.ForwardedRef<HTMLLIElement>) => {
    const {
      to,
      orientation,
      overflowing,
      tabProps,
      hidden,
      isSelected,
      variant = 'flat',
      borderStyle = 'solid',
      as = 'li',
    } = props;

    const ref = useObjectRef(forwardedRef);
    const InnerWrap = useCallback(
      ({children}) =>
        to ? (
          <TabLink
            to={to}
            onMouseDown={handleLinkClick}
            onPointerDown={handleLinkClick}
            orientation={orientation}
            tabIndex={-1}
          >
            {children}
          </TabLink>
        ) : (
          <TabInnerWrap orientation={orientation}>{children}</TabInnerWrap>
        ),
      [to, orientation]
    );
    if (variant === 'filled') {
      return (
        <FilledTabWrap
          {...tabProps}
          hidden={hidden}
          overflowing={overflowing}
          borderStyle={borderStyle}
          ref={ref}
          as={as}
        >
          {!isSelected && (
            <VariantStyledInteractionStateLayer hasSelectedBackground={false} />
          )}
          <FilledFocusLayer />
          {props.children}
        </FilledTabWrap>
      );
    }

    if (variant === 'floating') {
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
          {props.children}
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
        <InnerWrap>
          <StyledInteractionStateLayer
            orientation={orientation}
            higherOpacity={isSelected}
          />
          <FocusLayer orientation={orientation} />
          {props.children}
          <TabSelectionIndicator orientation={orientation} selected={isSelected} />
        </InnerWrap>
      </TabWrap>
    );
  }
);

/**
 * Renders a single tab item. This should not be imported directly into any
 * page/view – it's only meant to be used by <TabsList />. See the correct
 * usage in tabs.stories.js
 */
export const Tab = forwardRef(
  (
    {
      item,
      state,
      orientation,
      overflowing,
      variant,
      borderStyle = 'solid',
      as = 'li',
    }: TabProps,
    forwardedRef: React.ForwardedRef<HTMLLIElement>
  ) => {
    const ref = useObjectRef(forwardedRef);

    const {
      key,
      rendered,
      props: {to, hidden},
    } = item;
    const {tabProps, isSelected} = useTab({key, isDisabled: hidden}, state, ref);

    return (
      <BaseTab
        tabProps={tabProps}
        isSelected={isSelected}
        to={to}
        hidden={hidden}
        orientation={orientation}
        overflowing={overflowing}
        ref={ref}
        borderStyle={borderStyle}
        variant={variant}
        as={as}
      >
        {rendered}
      </BaseTab>
    );
  }
);
const FloatingTabWrap = styled('li', {shouldForwardProp: tabsShouldForwardProp})<{
  overflowing: boolean;
}>`
  &[aria-selected='true'] {
    ${p => css`
      color: ${p.theme.purple400};
      font-weight: ${p.theme.fontWeightBold};
      background-color: ${p.theme.purple100};
    `}
  }
  &[aria-selected='false'] {
    border-top: 1px solid transparent;
  }
  color: ${p => p.theme.gray300};
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

const FilledTabWrap = styled('li', {shouldForwardProp: tabsShouldForwardProp})<{
  borderStyle: 'dashed' | 'solid';
  overflowing: boolean;
}>`
  &[aria-selected='true'] {
    ${p => css`
      border-top: 1px ${p.borderStyle} ${p.theme.border};
      border-left: 1px ${p.borderStyle} ${p.theme.border};
      border-right: 1px ${p.borderStyle} ${p.theme.border};
      background-color: ${p.theme.background};
      font-weight: ${p.theme.fontWeightBold};
    `}
  }

  &[aria-selected='false'] {
    border-top: 1px solid transparent;
  }

  border-radius: 6px 6px 1px 1px;
  padding: ${space(0.75)} ${space(1.5)};

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

const TabWrap = styled('li', {shouldForwardProp: tabsShouldForwardProp})<{
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
`;

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
    ${theme.form.sm.height}px + ${orientation === 'horizontal' ? space(0.75) : '0px'}
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

const TabLink = styled(Link)<{orientation: Orientation}>`
  ${innerWrapStyles}

  &,
  &:hover {
    color: inherit;
  }
`;

const TabInnerWrap = styled('span')<{orientation: Orientation}>`
  ${innerWrapStyles}
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

const FocusLayer = styled('div')<{orientation: Orientation}>`
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

const FilledFocusLayer = styled('div')`
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;

  pointer-events: none;
  border-radius: inherit;
  z-index: 0;
  transition: border 0.1s ease-out;
  transition: border 0.1s ease-in;

  li:focus-visible & {
    border-top: 2px solid ${p => p.theme.focusBorder};
    border-left: 2px solid ${p => p.theme.focusBorder};
    border-right: 2px solid ${p => p.theme.focusBorder};
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

const TabSelectionIndicator = styled('div')<{
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
`;

import {forwardRef, useCallback} from 'react';
import styled from '@emotion/styled';
import {useTab} from '@react-aria/tabs';
import {useObjectRef} from '@react-aria/utils';
import {TabListState} from '@react-stately/tabs';
import {Node, Orientation} from '@react-types/shared';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import Link from 'sentry/components/links/link';
import space from 'sentry/styles/space';
import {Theme} from 'sentry/utils/theme';

import {tabsShouldForwardProp} from './utils';

interface TabProps {
  item: Node<any>;
  orientation: Orientation;
  /**
   * Whether this tab is overflowing the TabList container. If so, the tab
   * needs to be visually hidden. Users can instead select it via an overflow
   * menu.
   */
  overflowing: boolean;
  state: TabListState<any>;
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

/**
 * Renders a single tab item. This should not be imported directly into any
 * page/view – it's only meant to be used by <TabsList />. See the correct
 * usage in tabs.stories.js
 */
function BaseTab(
  {item, state, orientation, overflowing}: TabProps,
  forwardedRef: React.ForwardedRef<HTMLLIElement>
) {
  const ref = useObjectRef(forwardedRef);

  const {
    key,
    rendered,
    props: {to, hidden},
  } = item;
  const {tabProps, isSelected, isDisabled} = useTab(
    {key, isDisabled: hidden},
    state,
    ref
  );

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

  return (
    <TabWrap
      {...tabProps}
      hidden={hidden}
      disabled={isDisabled}
      selected={isSelected}
      overflowing={overflowing}
      ref={ref}
    >
      <InnerWrap>
        <StyledInteractionStateLayer
          orientation={orientation}
          higherOpacity={isSelected}
        />
        <FocusLayer orientation={orientation} />
        {rendered}
        <TabSelectionIndicator orientation={orientation} selected={isSelected} />
      </InnerWrap>
    </TabWrap>
  );
}

export const Tab = forwardRef(BaseTab);

const TabWrap = styled('li', {shouldForwardProp: tabsShouldForwardProp})<{
  disabled: boolean;
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

  ${p =>
    p.disabled &&
    `
      &, &:hover {
        color: ${p.theme.subText};
        pointer-events: none;
      }
    `}

  ${p =>
    p.overflowing &&
    `
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
}) => `
  display: flex;
  align-items: center;
  position: relative;
  height: calc(
    ${theme.form.sm.height}px +
      ${orientation === 'horizontal' ? space(0.75) : '0px'}
  );
  border-radius: ${theme.borderRadius};
  transform: translateY(1px);

  ${
    orientation === 'horizontal'
      ? `
        /* Extra padding + negative margin trick, to expand click area */
        padding: ${space(0.75)} ${space(1)} ${space(1.5)};
        margin-left: -${space(1)};
        margin-right: -${space(1)};
      `
      : `padding: ${space(0.75)} ${space(2)};`
  };
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

  li.focus-visible & {
    box-shadow: ${p => p.theme.focusBorder} 0 0 0 1px,
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
      ? `
        width: calc(100% - ${space(2)});
        height: 3px;

        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
      `
      : `
        width: 3px;
        height: 50%;

        left: 0;
        top: 50%;
        transform: translateY(-50%);
      `};
`;

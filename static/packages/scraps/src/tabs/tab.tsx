import type {ElementType, Ref} from 'react';
import {Fragment, useRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import type {AriaTabProps} from '@react-aria/tabs';
import {useTab} from '@react-aria/tabs';
import {useObjectRef} from '@react-aria/utils';
import type {TabListState} from '@react-stately/tabs';
import type {Node, Orientation} from '@react-types/shared';

import {Link} from '@sentry/scraps/link';
import type {Theme} from '@sentry/scraps/theme';
import {Tooltip, type TooltipProps} from '@sentry/scraps/tooltip';

import {isModifiedClick, tabsShouldForwardProp} from './utils';

const StyledTabWrap = styled('li', {
  shouldForwardProp: tabsShouldForwardProp,
})<{
  overflowing: boolean;
  selected: boolean;
}>`
  color: ${p =>
    p.selected
      ? p.theme.tokens.interactive.link.accent.rest
      : p.theme.tokens.interactive.link.neutral.rest};
  white-space: nowrap;
  cursor: pointer;

  &:focus-visible {
    outline: none;
  }

  &[aria-disabled] {
    opacity: 0.6;
    cursor: default;
  }

  ${p =>
    p.overflowing &&
    css`
      display: none;
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
  size: TabProps['size'];
  theme: Theme;
  variant: TabProps['variant'];
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
  margin-bottom: ${
    orientation === 'horizontal' && variant === 'flat' ? theme.space.xs : 0
  };

  ${
    orientation === 'horizontal'
      ? css`
          gap: ${theme.space.md};
        `
      : css`
          gap: ${theme.space.sm};
          /**
          * To align the SelectionIndicator (2px width, 4px spacing)
          */
          margin-left: ${
            variant === 'flat' ? `calc(${theme.space.xs} + ${selectionIndicatorSize})` : 0
          };
          /* static padding towards SelectionIndicator */
          padding-left: ${theme.space.md};
        `
  }

  li[aria-disabled]:hover & {
    background-color: transparent;
  }

  &:focus-visible,
  li:focus-visible & {
    outline: none;
    box-shadow: inset 0 0 0 2px ${theme.tokens.focus.default};
  }

  li:not([aria-disabled]):hover & {
    background-color: ${
      selected
        ? variant === 'floating'
          ? theme.tokens.interactive.transparent.accent.selected.background.hover
          : theme.tokens.interactive.transparent.accent.selected.background.rest
        : theme.tokens.interactive.transparent.neutral.background.hover
    };
    color: ${
      selected
        ? theme.tokens.interactive.link.accent.hover
        : theme.tokens.interactive.link.neutral.hover
    };
  }

  li:not([aria-disabled]):active & {
    background-color: ${
      selected
        ? variant === 'floating'
          ? theme.tokens.interactive.transparent.accent.selected.background.active
          : theme.tokens.interactive.transparent.accent.selected.background.hover
        : theme.tokens.interactive.transparent.neutral.background.active
    };
    color: ${
      selected
        ? theme.tokens.interactive.link.accent.active
        : theme.tokens.interactive.link.neutral.active
    };
  }

  ${
    variant === 'floating' &&
    selected &&
    css`
      background-color: ${
        theme.tokens.interactive.transparent.accent.selected.background.rest
      };
    `
  }
`;

const StyledTabSelectionIndicator = styled('div')<{
  orientation: Orientation;
  selected: boolean;
}>`
  position: absolute;
  border-radius: 1px;
  pointer-events: none;
  background: ${p =>
    p.selected ? p.theme.tokens.graphics.accent.vibrant : 'transparent'};

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
        `}
`;

export interface TabProps extends AriaTabProps {
  item: Node<any>;
  orientation: Orientation;
  /**
   * Whether this tab is overflowing the TabList container. If so, the tab
   * needs to be visually hidden. Users can instead select it via an overflow
   * menu.
   */
  overflowing: boolean;
  size: 'md' | 'sm' | 'xs';
  state: TabListState<any>;
  as?: ElementType;
  ref?: Ref<HTMLLIElement>;
  tooltipProps?: TooltipProps;
  variant?: 'flat' | 'floating';
}

export function Tab({
  ref,
  item,
  state,
  orientation,
  overflowing,
  variant = 'flat',
  size,
  as = 'li',
  tooltipProps,
}: TabProps) {
  const wrapperRef = useObjectRef(ref);
  const controlRef = useRef<HTMLElement>(null);
  const {
    key,
    rendered,
    props: {to, hidden},
  } = item;
  const {tabProps, isSelected, isDisabled} = useTab(
    {key, isDisabled: hidden, shouldSelectOnPressUp: !!to},
    state,
    controlRef
  );
  const isLink = !!to && !isDisabled;
  const styleProps = {orientation, variant, selected: isSelected, size};
  const content = (
    <Fragment>
      {rendered}
      {variant === 'flat' && (
        <StyledTabSelectionIndicator orientation={orientation} selected={isSelected} />
      )}
    </Fragment>
  );
  const tab = (
    <TabWrap
      {...(isLink ? {role: 'presentation'} : tabProps)}
      hidden={hidden}
      aria-disabled={isDisabled || undefined}
      selected={isSelected}
      overflowing={overflowing}
      ref={element => {
        wrapperRef.current = element;
        if (!isLink) {
          controlRef.current = element;
        }
      }}
      as={as}
    >
      {isLink ? (
        <TabLink
          {...tabProps}
          {...styleProps}
          to={to}
          ref={element => {
            controlRef.current = element;
          }}
          onMouseDown={event => {
            if (!isModifiedClick(event)) {
              tabProps.onMouseDown?.(event);
            }
          }}
          onPointerDown={event => {
            if (!isModifiedClick(event)) {
              tabProps.onPointerDown?.(event);
            }
          }}
          onClick={event => {
            if (!isModifiedClick(event)) {
              tabProps.onClick?.(event);
            }
          }}
          onKeyDown={event => {
            if (event.key === ' ') {
              event.preventDefault();
            }
            tabProps.onKeyDown?.(event);
          }}
        >
          {content}
        </TabLink>
      ) : (
        <TabInnerWrap {...styleProps}>{content}</TabInnerWrap>
      )}
    </TabWrap>
  );

  return tooltipProps ? <Tooltip {...tooltipProps}>{tab}</Tooltip> : tab;
}

const TabWrap = StyledTabWrap;

const TabLink = styled(Link)<{
  orientation: Orientation;
  selected: boolean;
  size: TabProps['size'];
  variant: TabProps['variant'];
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
  size: TabProps['size'];
  variant: TabProps['variant'];
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

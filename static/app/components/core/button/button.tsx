import styled from '@emotion/styled';

import {Flex, useResponsivePropValue} from '@sentry/scraps/layout';
import {IndeterminateLoader} from '@sentry/scraps/loader';
import {useSizeContext} from '@sentry/scraps/sizeContext';
import {Tooltip} from '@sentry/scraps/tooltip';
import {useClickTracking} from '@sentry/scraps/trackingContext';

import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';

import {
  DO_NOT_USE_BUTTON_ICON_SIZES as BUTTON_ICON_SIZES,
  DO_NOT_USE_getButtonStyles as getButtonStyles,
} from './styles';
import type {DO_NOT_USE_ButtonProps as ButtonProps, ButtonSize} from './types';
import {useButtonFunctionality} from './useButtonFunctionality';

function preventKeyboardSubmit(e: React.KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
  }
}

export type {ButtonProps};

export function Button({
  disabled,
  type = 'button',
  tooltipProps,
  busy,
  size: explicitSize,
  ...props
}: ButtonProps) {
  const contextSize = useSizeContext();
  const size = useResponsivePropValue(explicitSize ?? contextSize ?? 'md');
  const buttonProps = {
    ...props,
    type,
    disabled,
    busy,
  } satisfies ButtonProps;
  const {hasChildren, accessibleLabel} = useButtonFunctionality(buttonProps);
  const {handleClick} = useClickTracking(buttonProps, 'button');

  // When a tooltip is present, use aria-disabled instead of native disabled
  // so the button stays focusable and the tooltip can open on keyboard focus.
  const hasTooltip = !!tooltipProps?.title;
  const useAriaDisabled = disabled && hasTooltip;

  return (
    <Tooltip
      skipWrapper
      {...tooltipProps}
      title={tooltipProps?.title}
      disabled={!tooltipProps?.title}
    >
      <StyledButton
        aria-label={accessibleLabel}
        aria-busy={busy}
        disabled={useAriaDisabled ? undefined : disabled}
        size={size}
        type={type}
        busy={busy}
        {...props}
        aria-disabled={disabled}
        shapeVariant={hasChildren ? 'rectangular' : 'square'}
        onClick={handleClick}
        {...(useAriaDisabled && {onKeyDown: preventKeyboardSubmit})}
        role="button"
      >
        <Flex
          as="span"
          align="center"
          justify="center"
          minWidth="0"
          height="100%"
          whiteSpace="nowrap"
          visibility={busy ? 'hidden' : undefined}
        >
          {props.icon && (
            <Flex
              as="span"
              align="center"
              flexShrink={0}
              marginRight={
                hasChildren ? (size === 'xs' || size === 'zero' ? 'sm' : 'md') : undefined
              }
              aria-hidden="true"
            >
              <IconDefaultsProvider size={BUTTON_ICON_SIZES[size]}>
                {props.icon}
              </IconDefaultsProvider>
            </Flex>
          )}
          {props.children}
          {busy && (
            <Flex
              align="center"
              justify="center"
              position="absolute"
              visibility="visible"
              inset={0}
            >
              <IndeterminateLoader variant="monochrome" aria-hidden />
            </Flex>
          )}
        </Flex>
      </StyledButton>
    </Tooltip>
  );
}

const StyledButton = styled('button')<
  Omit<ButtonProps, 'size'> & {
    shapeVariant: 'rectangular' | 'square';
    size: ButtonSize;
  }
>`
  ${p => getButtonStyles(p)}
`;

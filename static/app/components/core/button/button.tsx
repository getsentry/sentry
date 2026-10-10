import {IconDefaultsProvider} from '@sentry/icons/useIconDefaults';

import {Flex, useResponsivePropValue} from '@sentry/scraps/layout';
import {IndeterminateLoader} from '@sentry/scraps/loader';
import {useSizeContext} from '@sentry/scraps/sizeContext';
import {Tooltip} from '@sentry/scraps/tooltip';
import {useClickTracking} from '@sentry/scraps/trackingContext';

import {
  getButtonContentClassName,
  getButtonDomProps,
  getButtonClassName,
  getButtonStyleState,
} from './linariaStyles';
import {DO_NOT_USE_BUTTON_ICON_SIZES as BUTTON_ICON_SIZES} from './styles';
import type {DO_NOT_USE_ButtonProps as ButtonProps} from './types';
import {useButtonFunctionality} from './useButtonFunctionality';

function preventKeyboardSubmit(
  e: React.KeyboardEvent,
  consumer?: React.KeyboardEventHandler
) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    e.stopPropagation();
  }
  consumer?.(e);
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

  const buttonElementProps = {
    'aria-label': accessibleLabel,
    'aria-busy': busy,
    disabled: useAriaDisabled ? undefined : disabled,
    type,
    ...props,
    ...(disabled !== undefined && {'aria-disabled': disabled}),
  };
  const styleState = getButtonStyleState(
    {...buttonElementProps, busy, disabled},
    size,
    hasChildren
  );
  const className = getButtonClassName(styleState, props.className);
  const contentClassName = getButtonContentClassName(styleState, {hideWhenBusy: true});

  return (
    <Tooltip
      skipWrapper
      {...tooltipProps}
      title={tooltipProps?.title}
      disabled={!tooltipProps?.title}
    >
      <button
        {...getButtonDomProps(buttonElementProps)}
        className={className}
        style={props.style}
        onClick={handleClick}
        {...(useAriaDisabled && {
          onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) =>
            preventKeyboardSubmit(e, props.onKeyDown),
        })}
        role="button"
      >
        <span className={contentClassName}>
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
        </span>
      </button>
    </Tooltip>
  );
}

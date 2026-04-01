import {useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {IndeterminateLoader} from '@sentry/scraps/loader';
import {useSizeContext} from '@sentry/scraps/sizeContext';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';

import {
  DO_NOT_USE_BUTTON_ICON_SIZES as BUTTON_ICON_SIZES,
  DO_NOT_USE_getButtonStyles as getButtonStyles,
} from './styles';
import type {DO_NOT_USE_ButtonProps as ButtonProps} from './types';
import {useButtonFunctionality} from './useButtonFunctionality';

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
  const size = explicitSize ?? contextSize ?? 'md';
  const theme = useTheme();
  const hasBeenBusy = useRef(false);
  if (busy) {
    hasBeenBusy.current = true;
  }
  const {handleClick, hasChildren, accessibleLabel} = useButtonFunctionality({
    ...props,
    type,
    disabled,
    busy,
  });

  return (
    <Tooltip
      skipWrapper
      {...tooltipProps}
      title={tooltipProps?.title}
      disabled={!tooltipProps?.title}
    >
      <StyledButton
        aria-label={accessibleLabel}
        aria-disabled={disabled}
        aria-busy={busy}
        disabled={disabled}
        size={size}
        type={type}
        busy={busy}
        {...props}
        shapeVariant={hasChildren ? 'rectangular' : 'square'}
        onClick={handleClick}
        role="button"
      >
        <Flex
          as="span"
          align="center"
          justify="center"
          minWidth="0"
          height="100%"
          overflow="visible"
          whiteSpace="nowrap"
        >
          <Flex
            as="span"
            align="center"
            style={{
              transition: busy
                ? `opacity ${theme.motion.smooth.fast}, transform ${theme.motion.smooth.fast}`
                : `opacity ${theme.motion.exit.fast}, transform ${theme.motion.exit.fast}`,
              opacity: busy ? 0 : 1,
              transform: busy
                ? `translateY(${theme.space['2xs']}) scale(0.95)`
                : 'translateY(0) scale(1)',
            }}
          >
            {props.icon && (
              <Flex
                as="span"
                align="center"
                flexShrink={0}
                marginRight={
                  hasChildren
                    ? size === 'xs' || size === 'zero'
                      ? 'sm'
                      : 'md'
                    : undefined
                }
                aria-hidden="true"
              >
                <IconDefaultsProvider size={BUTTON_ICON_SIZES[size]}>
                  {props.icon}
                </IconDefaultsProvider>
              </Flex>
            )}
            {props.children}
          </Flex>
          {hasBeenBusy.current && (
            <Flex
              align="center"
              justify="center"
              position="absolute"
              inset="0"
              style={{
                marginInline: '-4px',
                transition: busy
                  ? `opacity ${theme.motion.exit.fast}, transform ${theme.motion.exit.fast}`
                  : `opacity ${theme.motion.smooth.fast}, transform ${theme.motion.smooth.fast}`,
                opacity: busy ? 1 : 0,
                transform: busy
                  ? 'translateY(0) scale(1)'
                  : `translateY(-${theme.space['2xs']}) scale(0.95)`,
                pointerEvents: busy ? undefined : 'none',
              }}
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
    size: NonNullable<ButtonProps['size']>;
  }
>`
  ${p => getButtonStyles(p)}
`;

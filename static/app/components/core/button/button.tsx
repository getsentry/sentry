import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Flex} from '@sentry/scraps/layout';
import {IndeterminateLoader} from '@sentry/scraps/loader';
import {useSizeContext} from '@sentry/scraps/sizeContext';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import {testableTransition} from 'sentry/utils/testableTransition';

import {
  DO_NOT_USE_BUTTON_ICON_SIZES as BUTTON_ICON_SIZES,
  DO_NOT_USE_getButtonStyles as getButtonStyles,
} from './styles';
import type {DO_NOT_USE_ButtonProps as ButtonProps} from './types';
import {useButtonFunctionality} from './useButtonFunctionality';

const MotionFlex = motion.create(Flex);

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
          <MotionFlex
            as="span"
            align="center"
            animate={{
              opacity: busy ? 0 : 1,
              scale: busy ? 0.95 : 1,
              y: busy ? theme.space['2xs'] : 0,
              transition: busy
                ? theme.motion.framer.smooth.moderate
                : theme.motion.framer.exit.moderate,
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
          </MotionFlex>
          <AnimatePresence>
            {busy && (
              <MotionFlex
                key="loader"
                position="absolute"
                inset="0"
                align="center"
                justify="center"
                style={{marginInline: '-4px', pointerEvents: 'none'}}
                initial={{opacity: 0, scale: 0.95, y: `-${theme.space['2xs']}`}}
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: 0,
                  transition: testableTransition(theme.motion.framer.smooth.moderate),
                }}
                exit={{
                  opacity: 0,
                  scale: 0.95,
                  y: `-${theme.space['2xs']}`,
                  transition: testableTransition(theme.motion.framer.exit.moderate),
                }}
              >
                <IndeterminateLoader variant="monochrome" aria-hidden />
              </MotionFlex>
            )}
          </AnimatePresence>
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

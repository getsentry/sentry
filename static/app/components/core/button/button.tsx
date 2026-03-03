import styled from '@emotion/styled';
import {mergeProps} from '@react-aria/utils';

import {Flex} from '@sentry/scraps/layout';
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
  size = 'md',
  type = 'button',
  tooltipProps,
  ...props
}: ButtonProps) {
  const {handleClick, hasChildren, accessibleLabel} = useButtonFunctionality({
    ...props,
    type,
    disabled: props.disabled,
    busy: props.busy,
  });

  return (
    <StyledFlex
      busy={props.busy}
      size={size}
      icon={props.icon}
      priority={props.priority}
      disabled={props.disabled}
      className={props.className}
      display="inline-flex"
    >
      {flexProps => {
        return (
          <Tooltip
            skipWrapper
            {...tooltipProps}
            title={tooltipProps?.title}
            disabled={!tooltipProps?.title}
          >
            <button
              aria-disabled={props.disabled}
              aria-busy={props.busy}
              disabled={props.disabled}
              {...mergeProps(flexProps, props)}
              aria-label={accessibleLabel}
              type={type}
              onClick={handleClick}
              role="button"
            >
              <Flex
                as="span"
                align="center"
                justify="center"
                minWidth="0"
                height="100%"
                whiteSpace="nowrap"
              >
                {props.icon && (
                  <Flex
                    as="span"
                    align="center"
                    flexShrink={0}
                    position="relative"
                    marginRight={
                      hasChildren
                        ? size === 'xs' || size === 'zero'
                          ? 'sm'
                          : 'md'
                        : undefined
                    }
                  >
                    <IconDefaultsProvider size={BUTTON_ICON_SIZES[size]}>
                      {props.icon}
                    </IconDefaultsProvider>
                  </Flex>
                )}
                {props.children}
              </Flex>
            </button>
          </Tooltip>
        );
      }}
    </StyledFlex>
  );
}

const StyledFlex = styled(Flex)<ButtonProps>`
  ${p => getButtonStyles(p as any)}
`;

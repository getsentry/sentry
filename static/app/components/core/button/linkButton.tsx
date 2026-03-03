import styled from '@emotion/styled';
import {mergeProps} from '@react-aria/utils';

import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';

import {
  DO_NOT_USE_BUTTON_ICON_SIZES as BUTTON_ICON_SIZES,
  DO_NOT_USE_getButtonStyles as getButtonStyles,
} from './styles';
import type {DO_NOT_USE_LinkButtonProps as LinkButtonProps} from './types';
import {useButtonFunctionality} from './useButtonFunctionality';

export type {LinkButtonProps};

export function LinkButton({size = 'md', tooltipProps, ...props}: LinkButtonProps) {
  const {handleClick, hasChildren, accessibleLabel} = useButtonFunctionality({
    ...props,
    disabled: props.disabled,
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
        const tootlipProps = {
          skipWrapper: true as const,
          ...tooltipProps,
          title: tooltipProps?.title,
          disabled: !tooltipProps?.title,
        };

        const sharedProps = {
          ...mergeProps(flexProps, props),
          'aria-label': accessibleLabel,
          'aria-disabled': props.disabled,
          onClick: handleClick,
          role: 'button' as const,
        };

        const content = (
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
        );

        if ('to' in props && props.to && !props.disabled) {
          return (
            <Tooltip {...tootlipProps}>
              <Link {...sharedProps} to={props.to}>
                {content}
              </Link>
            </Tooltip>
          );
        }

        if ('href' in props && props.href && !props.disabled) {
          const {external, ...rest} = sharedProps;
          return (
            <Tooltip {...tootlipProps}>
              <a
                {...rest}
                {...(external ? {target: '_blank', rel: 'noreferrer noopener'} : {})}
                href={props.href}
              >
                {content}
              </a>
            </Tooltip>
          );
        }

        const {external: _e, replace: _r, preventScrollReset: _p, ...rest} = sharedProps;
        return (
          <Tooltip {...tootlipProps}>
            <a {...rest}>{content}</a>
          </Tooltip>
        );
      }}
    </StyledFlex>
  );
}

const StyledFlex = styled(Flex)<LinkButtonProps>`
  ${p => getLinkButtonStyles(p)}

  &:focus-visible {
    box-shadow: none;
  }
`;

const getLinkButtonStyles = (p: LinkButtonProps) => {
  const buttonStyles = getButtonStyles(p as any);
  return {
    ...(p.disabled || p.busy
      ? {color: buttonStyles.color, ':hover': {color: buttonStyles.color}}
      : undefined),
    ...buttonStyles,
  };
};

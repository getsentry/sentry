import isPropValid from '@emotion/is-prop-valid';
import {type Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

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

export function LinkButton({
  size = 'md',
  disabled,
  tooltipProps,
  ...props
}: LinkButtonProps) {
  const {handleClick, hasChildren, accessibleLabel} = useButtonFunctionality({
    ...props,
    disabled,
  });

  return (
    <Tooltip
      skipWrapper
      {...tooltipProps}
      title={tooltipProps?.title}
      disabled={!tooltipProps?.title}
    >
      <StyledLinkButton
        aria-label={accessibleLabel}
        aria-disabled={disabled}
        disabled={disabled}
        size={size}
        {...props}
        shapeVariant={hasChildren ? 'rectangular' : 'square'}
        href={disabled ? undefined : 'href' in props ? props.href : undefined}
        to={
          disabled
            ? // Disabled links are just text - this should have never been supported in the first place.
              // We cast it to the correct value to avoid a rightfully raised type error.
              (undefined as unknown as LocationDescriptor)
            : 'to' in props
              ? props.to
              : // Disabled links are just text - this should have never been supported in the first place.
                // We cast it to the correct value to avoid a rightfully raised type error.
                (undefined as unknown as LocationDescriptor)
        }
        onClick={handleClick}
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
              marginRight={
                hasChildren ? (size === 'xs' || size === 'zero' ? 'sm' : 'md') : undefined
              }
            >
              <IconDefaultsProvider size={BUTTON_ICON_SIZES[size]}>
                {props.icon}
              </IconDefaultsProvider>
            </Flex>
          )}
          {props.children}
        </Flex>
      </StyledLinkButton>
    </Tooltip>
  );
}

const StyledLinkButton = styled(
  ({
    size: _size,
    shapeVariant: _shapeVariant,
    ...props
  }: LinkButtonProps & {shapeVariant: 'rectangular' | 'square'}) => {
    if ('to' in props && props.to) {
      return <Link {...props} to={props.to} role="button" />;
    }

    if ('href' in props && props.href) {
      const {external, ...rest} = props;
      return (
        <a
          {...rest}
          {...(external ? {target: '_blank', rel: 'noreferrer noopener'} : {})}
          role="button"
        />
      );
    }

    // @ts-expect-error these props cannot be statically determined at this point
    const {external: _e, replace: _r, preventScrollReset: _p, ...rest} = props;
    return <a {...rest} role="button" />;
  },
  {
    shouldForwardProp: prop =>
      prop === 'external' ||
      prop === 'replace' ||
      prop === 'preventScrollReset' ||
      (typeof prop === 'string' && isPropValid(prop)),
  }
)<Omit<LinkButtonProps, 'size'> & {size: NonNullable<LinkButtonProps['size']>}>`
  ${p => getLinkButtonStyles(p, p.theme)}
`;

const getLinkButtonStyles = (
  p: Omit<LinkButtonProps, 'size'> & {
    shapeVariant: 'rectangular' | 'square';
    size: NonNullable<LinkButtonProps['size']>;
  },
  theme: Theme
) => {
  const buttonStyles = getButtonStyles({...p, theme, shapeVariant: p.shapeVariant});
  return {
    ...(p.disabled || p.busy
      ? {color: buttonStyles.color, ':hover': {color: buttonStyles.color}}
      : undefined),
    ...buttonStyles,
  };
};

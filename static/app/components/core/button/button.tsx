import {type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
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

function isNavButton(props: ButtonProps): props is Extract<ButtonProps, {href: unknown}> {
  return 'href' in props && props.href !== undefined;
}

export function Button(props: ButtonProps) {
  const contextSize = useSizeContext();
  const size = props.size ?? contextSize ?? 'md';
  const {handleClick, hasChildren, accessibleLabel} = useButtonFunctionality(props);
  const shapeVariant = hasChildren ? 'rectangular' : 'square';

  const content = (
    <Flex
      as="span"
      align="center"
      justify="center"
      minWidth="0"
      height="100%"
      whiteSpace="nowrap"
      visibility={props.busy ? 'hidden' : undefined}
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
      {props.busy && (
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
  );

  if (isNavButton(props)) {
    const {
      disabled,
      tooltipProps,
      busy,
      size: _size,
      icon: _icon,
      href,
      openInNewTab,
      preventScrollReset,
      replace: replaceProp,
      variant,
      analyticsEventKey: _aek,
      analyticsEventName: _aen,
      analyticsParams: _ap,
      ...rest
    } = props;

    return (
      <Tooltip
        skipWrapper
        {...tooltipProps}
        title={tooltipProps?.title}
        disabled={!tooltipProps?.title}
      >
        <StyledNavButton
          {...rest}
          aria-label={accessibleLabel}
          aria-disabled={disabled}
          aria-busy={busy}
          disabled={disabled}
          size={size}
          busy={busy}
          variant={variant}
          shapeVariant={shapeVariant}
          href={disabled ? undefined : href}
          openInNewTab={openInNewTab}
          preventScrollReset={preventScrollReset}
          replace={replaceProp}
          onClick={handleClick}
        >
          {content}
        </StyledNavButton>
      </Tooltip>
    );
  }

  const {
    disabled,
    tooltipProps,
    busy,
    size: _size,
    icon: _icon,
    type = 'button',
    variant,
    analyticsEventKey: _aek,
    analyticsEventName: _aen,
    analyticsParams: _ap,
    ...rest
  } = props;

  return (
    <Tooltip
      skipWrapper
      {...tooltipProps}
      title={tooltipProps?.title}
      disabled={!tooltipProps?.title}
    >
      <StyledButton
        {...rest}
        aria-label={accessibleLabel}
        aria-disabled={disabled}
        aria-busy={busy}
        disabled={disabled}
        size={size}
        type={type}
        busy={busy}
        variant={variant}
        shapeVariant={shapeVariant}
        onClick={handleClick}
        role="button"
      >
        {content}
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

interface StyledNavButtonInternalProps {
  shapeVariant: 'rectangular' | 'square';
  size: NonNullable<ButtonProps['size']>;
  busy?: boolean;
  disabled?: boolean;
  href?: ButtonProps['href'];
  openInNewTab?: boolean;
  preventScrollReset?: boolean;
  replace?: boolean;
  variant?: ButtonProps['variant'];
}

const StyledNavButton = styled(
  ({
    size: _size,
    shapeVariant: _shapeVariant,
    busy: _busy,
    variant: _variant,
    href,
    openInNewTab,
    preventScrollReset,
    replace: replaceProp,
    disabled,
    ...rest
  }: StyledNavButtonInternalProps & Omit<React.HTMLAttributes<HTMLElement>, 'title'>) => {
    if (disabled || href === undefined) {
      return <a {...rest} role="button" />;
    }

    return (
      <Link
        {...rest}
        href={href}
        openInNewTab={openInNewTab}
        replace={replaceProp}
        preventScrollReset={preventScrollReset}
        role="button"
      />
    );
  }
)<StyledNavButtonInternalProps>`
  ${p => getNavButtonStyles(p, p.theme)}
`;

const getNavButtonStyles = (p: StyledNavButtonInternalProps, theme: Theme) => {
  const buttonStyles = getButtonStyles({...p, theme, shapeVariant: p.shapeVariant});
  return {
    ...(p.disabled || p.busy
      ? {color: buttonStyles.color, ':hover': {color: buttonStyles.color}}
      : undefined),
    ...buttonStyles,
  };
};

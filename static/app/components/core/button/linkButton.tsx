import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
// eslint-disable-next-line boundaries/element-types
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';

import {DO_NOT_USE_BUTTON_ICON_SIZES as BUTTON_ICON_SIZES} from './styles';
import {DO_NOT_USE_getChonkButtonStyles as getChonkButtonStyles} from './styles.chonk';
import type {
  DO_NOT_USE_CommonButtonProps as CommonButtonProps,
  DO_NOT_USE_LinkButtonProps as LinkButtonProps,
} from './types';
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
    <Tooltip skipWrapper {...tooltipProps} title={props.title} disabled={!props.title}>
      <StyledLinkButton
        aria-label={accessibleLabel}
        aria-disabled={disabled}
        disabled={disabled}
        size={size}
        {...props}
        // @ts-expect-error set href as undefined to force "disabled" state.
        href={disabled ? undefined : 'href' in props ? props.href : undefined}
        // @ts-expect-error set to as undefined to force "disabled" state
        to={disabled ? undefined : 'to' in props ? props.to : undefined}
        onClick={handleClick}
      >
        {props.priority !== 'link' && (
          <InteractionStateLayer
            higherOpacity={
              props.priority && ['primary', 'danger'].includes(props.priority)
            }
          />
        )}
        <ButtonLabel size={size} borderless={props.borderless}>
          {props.icon && (
            <Icon size={size} hasChildren={hasChildren}>
              <IconDefaultsProvider size={BUTTON_ICON_SIZES[size]}>
                {props.icon}
              </IconDefaultsProvider>
            </Icon>
          )}
          {props.children}
        </ButtonLabel>
      </StyledLinkButton>
    </Tooltip>
  );
}

const StyledLinkButton = styled(
  ({size: _size, title: _title, ...props}: LinkButtonProps) => {
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
)<LinkButtonProps>`
  ${p => getChonkLinkButtonStyles(p)}
  &:focus-visible {
    box-shadow: none;
  }
`;

const getChonkLinkButtonStyles = (p: LinkButtonProps) => {
  const chonkStyles = getChonkButtonStyles(p as any);
  return {
    ...(p.disabled || p.busy
      ? {color: chonkStyles.color, ':hover': {color: chonkStyles.color}}
      : undefined),
    ...chonkStyles,
  };
};

const ButtonLabel = styled('span', {
  shouldForwardProp: prop =>
    typeof prop === 'string' &&
    isPropValid(prop) &&
    !['size', 'borderless'].includes(prop),
})<Pick<CommonButtonProps, 'size' | 'borderless'>>`
  height: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
`;

const Icon = styled('span')<{
  hasChildren?: boolean;
  size?: CommonButtonProps['size'];
}>`
  display: flex;
  align-items: center;
  margin-right: ${p =>
    p.hasChildren
      ? p.size === 'xs' || p.size === 'zero'
        ? p.theme.space.sm
        : p.theme.space.md
      : '0'};
  flex-shrink: 0;
`;

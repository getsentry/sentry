import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Tooltip} from 'sentry/components/core/tooltip';
// eslint-disable-next-line boundaries/element-types
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';

import {
  DO_NOT_USE_BUTTON_ICON_SIZES as BUTTON_ICON_SIZES,
  DO_NOT_USE_getButtonStyles as getButtonStyles,
} from './styles';
import type {
  DO_NOT_USE_ButtonProps as ButtonProps,
  DO_NOT_USE_CommonButtonProps as CommonButtonProps,
} from './types';
import {useButtonFunctionality} from './useButtonFunctionality';

export type {ButtonProps};

export function Button({
  size = 'md',
  disabled,
  type = 'button',
  title,
  tooltipProps,
  busy,
  ...props
}: ButtonProps) {
  const {handleClick, hasChildren, accessibleLabel} = useButtonFunctionality({
    ...props,
    type,
    disabled,
    busy,
  });

  return (
    <Tooltip skipWrapper {...tooltipProps} title={title} disabled={!title}>
      <StyledButton
        aria-label={accessibleLabel}
        aria-disabled={disabled}
        aria-busy={busy}
        disabled={disabled}
        size={size}
        type={type}
        busy={busy}
        {...props}
        onClick={handleClick}
        role="button"
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
      </StyledButton>
    </Tooltip>
  );
}

export const StyledButton = styled('button')<ButtonProps>`
  ${p => getButtonStyles(p)}
`;

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

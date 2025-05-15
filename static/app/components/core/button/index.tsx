import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import {space} from 'sentry/styles/space';

import {DO_NOT_USE_BUTTON_ICON_SIZES, DO_NOT_USE_getButtonStyles} from './styles';
import {DO_NOT_USE_getChonkButtonStyles} from './styles.chonk';
import type {DO_NOT_USE_CommonButtonProps} from './types';
import {useButtonFunctionality} from './useButtonFunctionality';

type ButtonElementProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'label' | 'size' | 'title'
>;

interface BaseButtonProps extends DO_NOT_USE_CommonButtonProps, ButtonElementProps {
  href?: never;
  ref?: React.Ref<HTMLButtonElement>;
  to?: never;
}

interface ButtonPropsWithoutAriaLabel extends BaseButtonProps {
  children: React.ReactNode;
}

interface ButtonPropsWithAriaLabel extends BaseButtonProps {
  'aria-label': string;
  children?: never;
}

export type ButtonProps = ButtonPropsWithoutAriaLabel | ButtonPropsWithAriaLabel;

export function Button({
  size = 'md',
  disabled,
  type = 'button',
  title,
  tooltipProps,
  ...props
}: ButtonProps) {
  const {handleClick, hasChildren, accessibleLabel} = useButtonFunctionality({
    ...props,
    type,
    disabled,
  });

  return (
    <Tooltip skipWrapper {...tooltipProps} title={title} disabled={!title}>
      <StyledButton
        aria-label={accessibleLabel}
        aria-disabled={disabled}
        disabled={disabled}
        size={size}
        type={type}
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
              <IconDefaultsProvider size={DO_NOT_USE_BUTTON_ICON_SIZES[size]}>
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
  ${p =>
    p.theme.isChonk
      ? DO_NOT_USE_getChonkButtonStyles(p as any)
      : DO_NOT_USE_getButtonStyles(p as any)}
`;

const ButtonLabel = styled('span', {
  shouldForwardProp: prop =>
    typeof prop === 'string' &&
    isPropValid(prop) &&
    !['size', 'borderless'].includes(prop),
})<Pick<DO_NOT_USE_CommonButtonProps, 'size' | 'borderless'>>`
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
`;

const Icon = styled('span')<{
  hasChildren?: boolean;
  size?: DO_NOT_USE_CommonButtonProps['size'];
}>`
  display: flex;
  align-items: center;
  margin-right: ${p =>
    p.hasChildren
      ? p.size === 'xs' || p.size === 'zero'
        ? space(0.75)
        : space(1)
      : '0'};
  flex-shrink: 0;
`;

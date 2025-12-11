import styled from '@emotion/styled';
import classNames from 'classnames';

import type {ButtonProps} from 'sentry/components/core/button';
import {Button} from 'sentry/components/core/button';

import ConfirmableAction from './confirmableAction';

const StyledAction = styled('a')<{disabled?: boolean}>`
  display: flex;
  align-items: center;
  ${p => p.disabled && 'cursor: not-allowed;'}
`;

const StyledButton = styled(Button)<{
  disabled?: boolean;
  hasDropdown?: boolean;
}>`
  display: flex;
  align-items: center;

  ${p => p.disabled && 'cursor: not-allowed;'}
  ${p => p.hasDropdown && `border-radius: ${p.theme.radius.md} 0 0 ${p.theme.radius.md}`};
`;

type ConfirmableActionProps = React.ComponentProps<typeof ConfirmableAction>;

type CommonProps = Omit<
  ConfirmableActionProps,
  'onConfirm' | 'confirmText' | 'children' | 'stopPropagation' | 'priority'
> & {
  children: React.ReactNode;
  className?: string;
  confirmLabel?: string;
  confirmPriority?: ConfirmableActionProps['priority'];
  disabled?: boolean;
  onAction?: () => void;
  shouldConfirm?: boolean;
  title?: string;
};

type Props = CommonProps &
  ({type?: 'button'} & Partial<Omit<ButtonProps, 'as' | 'children' | 'ref'>>);

export default function ActionLink({
  message,
  className,
  onAction,
  type,
  confirmLabel,
  disabled,
  children,
  shouldConfirm,
  confirmPriority,
  header,
  ...props
}: Props) {
  const actionCommonProps = {
    className: classNames(className, {disabled}),
    onClick: disabled ? undefined : onAction,
    disabled,
    children,
    ...props,
  };

  const action =
    type === 'button' ? (
      <StyledButton size="xs" {...actionCommonProps} />
    ) : (
      <StyledAction
        {...(actionCommonProps as React.ComponentProps<typeof StyledAction>)}
      />
    );

  if (shouldConfirm && onAction) {
    return (
      <ConfirmableAction
        shouldConfirm={shouldConfirm}
        priority={confirmPriority}
        disabled={disabled}
        message={message}
        header={header}
        confirmText={confirmLabel}
        onConfirm={onAction}
        stopPropagation={disabled}
      >
        {action}
      </ConfirmableAction>
    );
  }

  return action;
}

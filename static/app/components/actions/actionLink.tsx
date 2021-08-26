import * as React from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import ActionButton from './button';
import ConfirmableAction from './confirmableAction';

const StyledAction = styled('a')<{disabled?: boolean}>`
  display: flex;
  align-items: center;
  ${p => p.disabled && 'cursor: not-allowed;'}
`;

const StyledActionButton = styled(ActionButton)`
  display: flex;
  align-items: center;
  ${p => p.disabled && 'cursor: not-allowed;'}
`;

type ConfirmableActionProps = React.ComponentProps<typeof ConfirmableAction>;

type CommonProps = Omit<
  ConfirmableActionProps,
  'onConfirm' | 'confirmText' | 'children' | 'stopPropagation' | 'priority'
> & {
  title: string;
  onAction?: () => void;
  children?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  shouldConfirm?: boolean;
  confirmPriority?: ConfirmableActionProps['priority'];
  confirmLabel?: string;
};

type Props = CommonProps &
  ({type?: 'button'} & Partial<
    Omit<React.ComponentProps<typeof StyledActionButton>, 'as'>
  >);

export default function ActionLink({
  message,
  className,
  title,
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
    ['aria-label']: title,
    className: classNames(className, {disabled}),
    onClick: disabled ? undefined : onAction,
    disabled,
    children,
    ...props,
  };

  const action =
    type === 'button' ? (
      <StyledActionButton {...actionCommonProps} />
    ) : (
      <StyledAction {...actionCommonProps} />
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

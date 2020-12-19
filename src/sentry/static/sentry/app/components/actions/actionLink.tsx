import React from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import ActionButton from './button';
import ConfirmableAction from './confirmableAction';

type ConfirmableActionProps = React.ComponentProps<typeof ConfirmableAction>;

type Props = Omit<ConfirmableActionProps, 'onConfirm' | 'confirmText' | 'children'> & {
  title: string;
  children?: React.ReactNode;
  onAction: () => void;
  type?: 'button';
  disabled?: boolean;
  className?: string;
  shouldConfirm?: boolean;
  confirmLabel?: string;
} & Partial<React.ComponentProps<typeof ActionButton>>;

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
  ...props
}: Props) {
  return (
    <ConfirmableAction
      shouldConfirm={shouldConfirm}
      disabled={disabled}
      message={message}
      confirmText={confirmLabel}
      onConfirm={onAction}
    >
      <ActionLinkAnchor
        as={type === 'button' ? ActionButton : 'a'}
        aria-label={title}
        className={classNames(className, {disabled})}
        onClick={disabled ? undefined : onAction}
        disabled={disabled}
        {...props}
      >
        {children}
      </ActionLinkAnchor>
    </ConfirmableAction>
  );
}

const ActionLinkAnchor = styled('a')<{
  as: any;
  disabled?: boolean;
}>`
  display: flex;
  align-items: center;
  ${p =>
    p.disabled &&
    `
    cursor: not-allowed;
    `}
`;

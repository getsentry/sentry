import styled from '@emotion/styled';
import classNames from 'classnames';

import ActionButton from './button';
import ConfirmableAction from './confirmableAction';

const StyledAction = styled('a')<{disabled?: boolean}>`
  display: flex;
  align-items: center;
  ${p => p.disabled && 'cursor: not-allowed;'}
`;

const StyledActionButton = styled(ActionButton)<{
  disabled?: boolean;
  hasDropdown?: boolean;
}>`
  display: flex;
  align-items: center;

  ${p => p.disabled && 'cursor: not-allowed;'}
  ${p => p.hasDropdown && `border-radius: ${p.theme.borderRadiusLeft}`};
`;

type ConfirmableActionProps = React.ComponentProps<typeof ConfirmableAction>;

type CommonProps = Omit<
  ConfirmableActionProps,
  'onConfirm' | 'confirmText' | 'children' | 'stopPropagation' | 'priority'
> & {
  children: React.ReactChild;
  className?: string;
  confirmLabel?: string;
  confirmPriority?: ConfirmableActionProps['priority'];
  disabled?: boolean;
  onAction?: () => void;
  shouldConfirm?: boolean;
  title?: string;
};

type Props = CommonProps &
  ({type?: 'button'} & Partial<
    Omit<React.ComponentProps<typeof StyledActionButton>, 'as' | 'children'>
  >);

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

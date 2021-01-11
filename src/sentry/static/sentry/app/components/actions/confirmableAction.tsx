import React from 'react';

import Confirm from 'app/components/confirm';

type ConfirmProps = React.ComponentProps<typeof Confirm>;
type Props = {
  children: React.ReactNode | ConfirmProps['children'];
  shouldConfirm?: boolean;
} & Partial<Pick<ConfirmProps, 'confirmText'>> &
  Pick<ConfirmProps, 'message' | 'disabled' | 'confirmText' | 'onConfirm'>;

export default function ConfirmableAction({shouldConfirm, children, ...props}: Props) {
  if (shouldConfirm) {
    return <Confirm {...props}>{children as ConfirmProps['children']}</Confirm>;
  }

  return <React.Fragment>{children}</React.Fragment>;
}

import {Fragment} from 'react';

import Confirm from 'sentry/components/confirm';

type ConfirmProps = React.ComponentProps<typeof Confirm>;
type Props = {
  children: React.ReactNode | ConfirmProps['children'];
  shouldConfirm?: boolean;
} & Partial<
  Pick<ConfirmProps, 'confirmText' | 'priority' | 'stopPropagation' | 'header'>
> &
  Pick<ConfirmProps, 'message' | 'disabled' | 'confirmText' | 'onConfirm'>;

export default function ConfirmableAction({shouldConfirm, children, ...props}: Props) {
  if (shouldConfirm) {
    return <Confirm {...props}>{children as ConfirmProps['children']}</Confirm>;
  }

  return <Fragment>{children}</Fragment>;
}

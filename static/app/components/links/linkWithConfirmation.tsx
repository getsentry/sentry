import {ButtonProps} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';

import Anchor from './anchor';

type Props = {
  message: React.ReactNode;
  onConfirm: () => void;
  title: string;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  priority?: ButtonProps['priority'];
};

/**
 * <Confirm> is a more generic version of this component
 */
function LinkWithConfirmation({
  className,
  disabled,
  title,
  children,
  ...otherProps
}: Props) {
  return (
    <Confirm {...otherProps} disabled={disabled}>
      <Anchor href="#" className={className} disabled={disabled} title={title}>
        {children}
      </Anchor>
    </Confirm>
  );
}

export default LinkWithConfirmation;

import {ReactNode} from 'react';

import {Alert} from 'sentry/components/alert';
import {t} from 'sentry/locale';

type Props = React.ComponentPropsWithoutRef<typeof Alert> & {
  message?: ReactNode;
};

function ReinstallAlert({
  message = t('Reinstall required for disabled integrations.'),
  ...props
}: Props) {
  return (
    <Alert data-test-id="disabled-alert" type="warning" showIcon {...props}>
      {message}
    </Alert>
  );
}

export default ReinstallAlert;

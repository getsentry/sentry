import {ReactNode} from 'react';

import {Alert} from 'sentry/components/alert';
import {t} from 'sentry/locale';
import {Integration} from 'sentry/types';
import {getIntegrationStatus} from 'sentry/utils/integrationUtil';

type Props = React.ComponentPropsWithoutRef<typeof Alert> & {
  integrations: Integration[] | null;
  message?: ReactNode;
};

function ReinstallAlert({
  message = t('Reinstall required for disabled integrations.'),
  integrations = [],
  ...props
}: Props) {
  const statusList = integrations?.map(getIntegrationStatus);
  if (statusList?.includes('disabled')) {
    return (
      <Alert data-test-id="disabled-alert" type="warning" showIcon {...props}>
        {message}
      </Alert>
    );
  }
  return null;
}

export default ReinstallAlert;

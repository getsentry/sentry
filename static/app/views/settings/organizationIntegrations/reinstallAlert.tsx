import {Alert} from 'sentry/components/alert';
import {t} from 'sentry/locale';
import {Integration} from 'sentry/types';
import {getIntegrationStatus} from 'sentry/utils/integrationUtil';

type Props = {
  integrations: Integration[] | null;
};

function ReinstallAlert({integrations = []}: Props) {
  const statusList = integrations?.map(getIntegrationStatus);
  if (statusList?.includes('disabled')) {
    return (
      <Alert data-test-id="disabled-alert" type="warning" showIcon>
        {t('Reinstall required for disabled integrations.')}
      </Alert>
    );
  }
  return null;
}

export default ReinstallAlert;

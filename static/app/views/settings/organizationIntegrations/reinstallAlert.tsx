import {Alert} from 'sentry/components/alert';
import {t} from 'sentry/locale';
import type {Integration} from 'sentry/types/integrations';
import {getIntegrationStatus} from 'sentry/utils/integrationUtil';

type Props = {
  integrations: Integration[] | null;
};

function ReinstallAlert({integrations = []}: Props) {
  const statusList = integrations?.map(getIntegrationStatus);
  if (statusList?.includes('disabled')) {
    return (
      <Alert.Container>
        <Alert margin data-test-id="disabled-alert" type="warning" showIcon>
          {t('Reinstall required for disabled integrations.')}
        </Alert>
      </Alert.Container>
    );
  }
  return null;
}

export default ReinstallAlert;

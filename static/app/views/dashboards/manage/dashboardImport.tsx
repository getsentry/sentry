import {Button} from 'sentry/components/button';
import {IconDownload} from 'sentry/icons';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';

import {openDashboardImport} from '../../metrics/dashboardImportModal';

// Allows easy import of dashboards. Visible to superusers only.
export function DashboardImportButton() {
  const organization = useOrganization();
  const user = useUser();

  if (!user.isSuperuser) {
    return null;
  }

  return (
    <Button
      onClick={() => {
        openDashboardImport(organization);
      }}
      size="sm"
      icon={<IconDownload />}
    >
      {t('Import Dashboard')}
    </Button>
  );
}

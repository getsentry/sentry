import {Button} from '@sentry/scraps/button';

import {openAlertsMonitorsShowcase} from 'sentry/components/workflowEngine/ui/alertsMonitorsShowcase';
import {IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

export function AlertsMonitorsShowcaseButton() {
  const organization = useOrganization();

  return (
    <Button
      size="sm"
      icon={<IconInfo />}
      onClick={() => openAlertsMonitorsShowcase({organization})}
      aria-label={t('Monitors and Alerts tour')}
    />
  );
}

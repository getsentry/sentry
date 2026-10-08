import {IconInfo} from '@sentry/icons/info';

import {Button} from '@sentry/scraps/button';

import {openAlertsMonitorsShowcase} from 'sentry/components/workflowEngine/ui/alertsMonitorsShowcase';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

export function AlertsMonitorsShowcaseButton() {
  const organization = useOrganization();
  const label = t('Monitors and Alerts tour');

  return (
    <Button
      size="sm"
      icon={<IconInfo />}
      onClick={() => openAlertsMonitorsShowcase({organization})}
      tooltipProps={{title: label}}
      aria-label={label}
    />
  );
}

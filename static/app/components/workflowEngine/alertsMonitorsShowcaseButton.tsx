import {IconInfo} from '@sentry/icons/info';

import {Button} from '@sentry/scraps/button';

import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

import {openAlertsMonitorsShowcase} from './ui/alertsMonitorsShowcase';

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

import {LinkButton} from 'sentry/components/button';
import {Flex} from 'sentry/components/container/flex';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import useOrganization from 'sentry/utils/useOrganization';

export function MetricIssueSidebarSection({event}: {event?: Event}) {
  const organization = useOrganization();
  const alert_rule_id = event?.contexts?.metric_alert?.alert_rule_id;

  if (!alert_rule_id) {
    return null;
  }

  return (
    <Flex>
      <LinkButton
        aria-label={t('View detector details')}
        href={`/organizations/${organization.slug}/alerts/rules/details/${alert_rule_id}/`}
        style={{width: '100%'}}
      >
        {t('View detector details')}
      </LinkButton>
    </Flex>
  );
}

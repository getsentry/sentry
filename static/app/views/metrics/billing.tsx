import Alert from 'sentry/components/alert';
import {Button, LinkButton} from 'sentry/components/button';
import HookOrDefault from 'sentry/components/hookOrDefault';
import Link from 'sentry/components/links/link';
import {t, tct} from 'sentry/locale';
import {getFormattedDate} from 'sentry/utils/dates';
import {hasCustomMetrics} from 'sentry/utils/metrics/features';
import useOrganization from 'sentry/utils/useOrganization';

export const MetricsPlanUpgrade = HookOrDefault({
  hookName: 'component:metrics-plan-upgrade',
  defaultComponent: () => null,
});

export function TopBanner() {
  const organization = useOrganization();

  return (
    <MetricsPlanUpgrade organization={organization}>
      {upgradeProps => {
        if (upgradeProps) {
          const formattedDate = getFormattedDate(
            upgradeProps.billingStartDate,
            'MMM D, YYYY'
          );
          if (hasCustomMetrics(organization)) {
            return (
              <Alert system type="info">
                {tct(
                  'In order to continue using metrics after [billingStartDate] you will need to update your plan. ',
                  {billingStartDate: formattedDate}
                )}
                <Link to={upgradeProps.to}>{upgradeProps.label}</Link>
              </Alert>
            );
          }
          return (
            <Alert system type="info">
              {t('In order to use metrics, you need to update your plan. ')}
              <Link to={upgradeProps.to}>{upgradeProps.label}</Link>
            </Alert>
          );
        }
        return (
          <Alert type="info">
            {t('Starting on June 5th 2024, Sentry will start charging for metrics.')}
          </Alert>
        );
      }}
    </MetricsPlanUpgrade>
  );
}

export function OnboardingPanelPrimaryActionButton({onClick}: {onClick: () => void}) {
  const organization = useOrganization();

  return (
    <MetricsPlanUpgrade organization={organization}>
      {upgradeProps => {
        return upgradeProps && !hasCustomMetrics(organization) ? (
          <LinkButton priority="primary" to={upgradeProps.to}>
            {upgradeProps.label}
          </LinkButton>
        ) : (
          <Button priority="primary" onClick={onClick}>
            {t('Add Custom Metric')}
          </Button>
        );
      }}
    </MetricsPlanUpgrade>
  );
}

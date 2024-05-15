import Alert from 'sentry/components/alert';
import {Button, LinkButton} from 'sentry/components/button';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

export const MetricsSubscriptionCTAProvider = HookOrDefault({
  hookName: 'component:metrics-subscription-cta',
  defaultComponent: () => null,
});

export function TopBanner() {
  const organization = useOrganization();

  return (
    <MetricsSubscriptionCTAProvider organization={organization}>
      {subscriptionCTAProps => {
        if (!subscriptionCTAProps) {
          return null;
        }
        return (
          <Alert system type={subscriptionCTAProps.type}>
            {subscriptionCTAProps.description}
          </Alert>
        );
      }}
    </MetricsSubscriptionCTAProvider>
  );
}

export function OnboardingPanelPrimaryActionButton({onClick}: {onClick: () => void}) {
  const organization = useOrganization();

  return (
    <MetricsSubscriptionCTAProvider organization={organization}>
      {subscriptionCTAProps => {
        return subscriptionCTAProps ? (
          <LinkButton priority="primary" to={subscriptionCTAProps.href}>
            {subscriptionCTAProps.cta}
          </LinkButton>
        ) : (
          <Button priority="primary" onClick={onClick}>
            {t('Add Custom Metric')}
          </Button>
        );
      }}
    </MetricsSubscriptionCTAProvider>
  );
}

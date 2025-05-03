import {LinkButton, type LinkButtonProps} from 'sentry/components/core/button/linkButton';
import {IconGithub} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {IntegrationView} from 'sentry/utils/analytics/integrations';
import {
  platformEventLinkMap,
  PlatformEvents,
} from 'sentry/utils/analytics/integrations/platformAnalyticsEvents';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import withOrganization from 'sentry/utils/withOrganization';

interface ExampleIntegrationButtonProps extends Omit<LinkButtonProps, 'to' | 'href'> {
  analyticsView: IntegrationView['view'];
  organization: Organization;
}

/**
 * Button to direct users to the Example App repository
 */
function ExampleIntegrationButton({
  organization,
  analyticsView,
  ...buttonProps
}: ExampleIntegrationButtonProps) {
  return (
    <LinkButton
      size="sm"
      external
      href={platformEventLinkMap[PlatformEvents.EXAMPLE_SOURCE] ?? ''}
      onClick={() => {
        trackIntegrationAnalytics(PlatformEvents.EXAMPLE_SOURCE, {
          organization,
          view: analyticsView,
        });
      }}
      icon={<IconGithub />}
      {...buttonProps}
    >
      {t('View Example App')}
    </LinkButton>
  );
}
export default withOrganization(ExampleIntegrationButton);

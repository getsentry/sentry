import {Button, ButtonProps} from 'sentry/components/button';
import {IconGithub} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {IntegrationView} from 'sentry/utils/analytics/integrations';
import {
  platformEventLinkMap,
  PlatformEvents,
} from 'sentry/utils/analytics/integrations/platformAnalyticsEvents';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import withOrganization from 'sentry/utils/withOrganization';

type ExampleIntegrationButtonProps = {
  analyticsView: IntegrationView['view'];
  organization: Organization;
} & ButtonProps;

/**
 * Button to direct users to the Example App repository
 */
function ExampleIntegrationButton({
  organization,
  analyticsView,
  ...buttonProps
}: ExampleIntegrationButtonProps) {
  return (
    <Button
      size="sm"
      external
      href={platformEventLinkMap[PlatformEvents.EXAMPLE_SOURCE]}
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
    </Button>
  );
}
export default withOrganization(ExampleIntegrationButton);

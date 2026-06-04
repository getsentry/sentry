import {LinkButton, type LinkButtonProps} from '@sentry/scraps/button';

import {IconGithub} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {IntegrationView} from 'sentry/utils/analytics/integrations';
import {
  platformEventLinkMap,
  PlatformEvents,
} from 'sentry/utils/analytics/integrations/platformAnalyticsEvents';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import {useOrganization} from 'sentry/utils/useOrganization';

interface ExampleIntegrationButtonProps extends Omit<LinkButtonProps, 'to' | 'href'> {
  analyticsView: IntegrationView['view'];
}

/**
 * Button to direct users to the Example App repository
 */
export function ExampleIntegrationButton({
  analyticsView,
  ...buttonProps
}: ExampleIntegrationButtonProps) {
  const organization = useOrganization();
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

import {useEffect} from 'react';

import {ExternalLink, Link} from '@sentry/scraps/link';

import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';

import {SubscriptionLoadingFallback} from 'getsentry/components/subscriptionLoadingFallback';
import {useSubscription} from 'getsentry/hooks/useSubscription';
import {
  SpendVisibilityEvents,
  trackSpendVisibilityAnaltyics,
} from 'getsentry/utils/trackSpendVisibilityAnalytics';
import {SPIKE_PROTECTION_DOCS_LINK} from 'getsentry/views/spikeProtection/constants';
import {SpikeProtectionProjects} from 'getsentry/views/spikeProtection/spikeProtectionProjects';
import {SubscriptionPageContainer} from 'getsentry/views/subscriptionPage/components/subscriptionPageContainer';

export default function SpikeProtectionRoot() {
  const organization = useOrganization();
  const subscription = useSubscription();
  useEffect(() => {
    if (!subscription) {
      return;
    }
    trackSpendVisibilityAnaltyics(SpendVisibilityEvents.SP_SETTINGS_VIEWED, {
      organization,
      subscription,
      view: 'spike_protection_settings',
    });
  }, [organization, subscription]);

  if (!subscription) {
    return <SubscriptionLoadingFallback />;
  }

  const docsLink = (
    <ExternalLink
      href={SPIKE_PROTECTION_DOCS_LINK}
      onClick={() => {
        trackSpendVisibilityAnaltyics(SpendVisibilityEvents.SP_DOCS_CLICKED, {
          organization,
          subscription,
          view: 'spike_protection_settings',
        });
      }}
    />
  );

  const personalNotifsLink = (
    <Link to="/settings/account/notifications/spike-protection/" />
  );

  return (
    <SubscriptionPageContainer>
      <SentryDocumentTitle
        title={t('Spike Protection Settings')}
        orgSlug={organization.slug}
      />
      <SettingsPageHeader
        title={t('Spike Protection')}
        subtitle={tct(
          'Spike Protection establishes a spike threshold based on a project’s historical event volume. Once that threshold is reached, events from the project will be dropped. You can set an action to send notifications in the project settings below. Configure personal notifications for spike protection [personalNotifsLink: here]. [docsLink: Learn more].',
          {docsLink, personalNotifsLink}
        )}
      />
      <ProjectPermissionAlert />

      <NoProjectMessage organization={organization}>
        <SpikeProtectionProjects subscription={subscription} />
      </NoProjectMessage>
    </SubscriptionPageContainer>
  );
}

import {useEffect} from 'react';

import {ExternalLink, Link} from 'sentry/components/core/link';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import withOrganization from 'sentry/utils/withOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';

import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import trackSpendVisibilityAnaltyics, {
  SpendVisibilityEvents,
} from 'getsentry/utils/trackSpendVisibilityAnalytics';
import {SPIKE_PROTECTION_DOCS_LINK} from 'getsentry/views/spikeProtection/constants';
import SpikeProtectionProjects from 'getsentry/views/spikeProtection/spikeProtectionProjects';
import SubscriptionPageContainer from 'getsentry/views/subscriptionPage/components/subscriptionPageContainer';

type Props = {organization: Organization; subscription: Subscription};

function SpikeProtectionRoot({organization, subscription}: Props) {
  useEffect(() => {
    trackSpendVisibilityAnaltyics(SpendVisibilityEvents.SP_SETTINGS_VIEWED, {
      organization,
      subscription,
      view: 'spike_protection_settings',
    });
  }, [organization, subscription]);

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
    <SubscriptionPageContainer background="secondary">
      <SentryDocumentTitle
        title={t('Spike Protection Settings')}
        orgSlug={organization.slug}
      />
      <SettingsPageHeader
        title={t('Spike Protection')}
        subtitle={tct(
          'Spike Protection establishes a spike threshold based on a project’s historical event volume. Once that threshold is reached, events from the project will be dropped and you will receive a notification. Configure personal notifications for spike protection [personalNotifsLink: here]. [docsLink: Learn more].',
          {docsLink, personalNotifsLink}
        )}
      />
      <ProjectPermissionAlert />

      <NoProjectMessage organization={organization}>
        <SpikeProtectionProjects />
      </NoProjectMessage>
    </SubscriptionPageContainer>
  );
}

export default withOrganization(withSubscription(SpikeProtectionRoot));

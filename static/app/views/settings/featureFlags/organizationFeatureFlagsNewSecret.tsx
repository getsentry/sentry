import {Fragment, useCallback, useState} from 'react';

import Access from 'sentry/components/acl/access';
import ExternalLink from 'sentry/components/links/externalLink';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {browserHistory} from 'sentry/utils/browserHistory';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import withOrganization from 'sentry/utils/withOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import NewProviderForm from 'sentry/views/settings/featureFlags/newProviderForm';
import NewSecretHandler from 'sentry/views/settings/featureFlags/newSecretHandler';

export function OrganizationFeatureFlagsNewSecet({
  organization,
}: {
  organization: Organization;
}) {
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const handleGoBack = useCallback(() => {
    browserHistory.push(normalizeUrl(`/settings/${organization.slug}/feature-flags/`));
  }, [organization.slug]);

  return (
    <Access access={['org:write']}>
      {({hasAccess}) => (
        <Fragment>
          <SentryDocumentTitle title={t('Add New Provider')} />
          <SettingsPageHeader title={t('Add New Provider')} />

          <TextBlock>
            {t(
              'Integrating Sentry with your feature flag provider enables Sentry to correlate feature flag changes with new error events and mark certain changes as suspicious. This page lists the webhooks you have set up with external providers. Note that each provider can only have one associated signing secret.'
            )}
          </TextBlock>
          <TextBlock>
            {tct(
              'Learn more about how to interact with feature flag insights within the Sentry UI by reading the [link:documentation].',
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/product/issues/issue-details/#feature-flags" />
                ),
              }
            )}
          </TextBlock>

          <Panel>
            <PanelHeader>{t('Add New Provider')}</PanelHeader>

            <PanelBody>
              {newSecret ? (
                <NewSecretHandler onGoBack={handleGoBack} secret={newSecret} />
              ) : (
                <NewProviderForm
                  organization={organization}
                  onCreatedSecret={
                    hasAccess ? (secret: string) => setNewSecret(secret) : undefined
                  }
                />
              )}
            </PanelBody>
          </Panel>
        </Fragment>
      )}
    </Access>
  );
}

export default withOrganization(OrganizationFeatureFlagsNewSecet);

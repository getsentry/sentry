import {Fragment, useCallback, useState} from 'react';

import {hasEveryAccess} from 'sentry/components/acl/access';
import AnalyticsArea from 'sentry/components/analyticsArea';
import {Alert} from 'sentry/components/core/alert';
import {ExternalLink} from 'sentry/components/core/link';
import EmptyMessage from 'sentry/components/emptyMessage';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import NewProviderForm from 'sentry/views/settings/featureFlags/changeTracking/newProviderForm';
import NewSecretHandler from 'sentry/views/settings/featureFlags/changeTracking/newSecretHandler';

function OrganizationFeatureFlagsNewSecet() {
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>('');
  const organization = useOrganization();
  const navigate = useNavigate();

  const handleGoBack = useCallback(() => {
    navigate(
      normalizeUrl(`/settings/${organization.slug}/feature-flags/change-tracking/`)
    );
  }, [organization.slug, navigate]);

  const canWrite = hasEveryAccess(['org:write'], {organization});
  const canAdmin = hasEveryAccess(['org:admin'], {organization});
  const hasPermission = canWrite || canAdmin;

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Add New Provider')} />
      <SettingsPageHeader title={t('Add New Provider')} />

      <TextBlock>
        {tct(
          'Integrating Sentry with your feature flag provider enables Sentry to correlate feature flag changes with new error events and mark certain changes as suspicious. Learn more about how to interact with feature flag insights within the Sentry UI by reading the [link:documentation].',
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/product/explore/feature-flags/#change-tracking" />
            ),
          }
        )}
      </TextBlock>
      <Alert.Container>
        <Alert type="info">
          {t('Note that each provider can only have one associated signing secret.')}
        </Alert>
      </Alert.Container>

      {!hasPermission && (
        <Alert.Container>
          <Alert type="error">
            {t(
              'You must be an organization owner or manager to add feature flag providers. Please contact your organization administrator.'
            )}
          </Alert>
        </Alert.Container>
      )}

      <Panel>
        <PanelHeader>{t('Add New Provider')}</PanelHeader>
        <PanelBody>
          {hasPermission ? (
            newSecret ? (
              <NewSecretHandler
                onGoBack={handleGoBack}
                secret={newSecret}
                provider={provider}
              />
            ) : (
              <NewProviderForm
                onCreatedSecret={setNewSecret}
                onSetProvider={setProvider}
              />
            )
          ) : (
            <EmptyMessage
              description={t('You do not have permission to add feature flag providers.')}
            />
          )}
        </PanelBody>
      </Panel>
    </Fragment>
  );
}

export default function OrganizationFeatureFlagsNewSecretRoute() {
  return (
    <AnalyticsArea name="feature_flag_org_settings">
      <OrganizationFeatureFlagsNewSecet />
    </AnalyticsArea>
  );
}

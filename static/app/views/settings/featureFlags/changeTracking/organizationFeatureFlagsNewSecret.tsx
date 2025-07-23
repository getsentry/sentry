import {Fragment, useCallback, useState} from 'react';

import {hasEveryAccess} from 'sentry/components/acl/access';
import AnalyticsArea from 'sentry/components/analyticsArea';
import {Alert} from 'sentry/components/core/alert';
import {ExternalLink} from 'sentry/components/core/link';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {
  makeFetchSecretQueryKey,
  type Secret,
} from 'sentry/views/settings/featureFlags/changeTracking';
import NewProviderForm from 'sentry/views/settings/featureFlags/changeTracking/newProviderForm';
import NewSecretHandler from 'sentry/views/settings/featureFlags/changeTracking/newSecretHandler';

type FetchSecretResponse = {data: Secret[]};

function OrganizationFeatureFlagsNewSecret() {
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const organization = useOrganization();
  const user = useUser();
  const navigate = useNavigate();

  // get existing secrets so we can check if the provider is already configured
  const {
    isPending: _isSecretsPending,
    isError: _isSecretsError,
    data: secretList,
    refetch: _refetchSecretList,
  } = useApiQuery<FetchSecretResponse>(
    makeFetchSecretQueryKey({orgSlug: organization.slug}),
    {
      staleTime: Infinity,
    }
  );

  const handleGoBack = useCallback(() => {
    navigate(
      normalizeUrl(`/settings/${organization.slug}/feature-flags/change-tracking/`)
    );
  }, [organization.slug, navigate]);

  // check if selected provider is already configured
  const existingSecret = secretList?.data?.find(
    secret => secret.provider.toLowerCase() === selectedProvider.toLowerCase()
  );

  // can override an existing provider if user is owner, manager, or original creator
  // anyone can add a new provider
  const canOverrideProvider = existingSecret
    ? hasEveryAccess(['org:write'], {organization}) ||
      hasEveryAccess(['org:admin'], {organization}) ||
      existingSecret.createdBy === Number(user.id)
    : true;

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

      {existingSecret && !canOverrideProvider && (
        <Alert.Container>
          <Alert type="warning" showIcon>
            {t(
              'This provider is already configured. Only owners, managers, and the original creator can override it.'
            )}
          </Alert>
        </Alert.Container>
      )}

      <Panel>
        <PanelHeader>{t('Add New Provider')}</PanelHeader>
        <PanelBody>
          {newSecret ? (
            <NewSecretHandler
              onGoBack={handleGoBack}
              secret={newSecret}
              provider={provider}
            />
          ) : (
            <NewProviderForm
              onCreatedSecret={setNewSecret}
              onProviderChange={setSelectedProvider}
              onSetProvider={setProvider}
              canOverrideProvider={canOverrideProvider}
              existingSecret={existingSecret}
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
      <OrganizationFeatureFlagsNewSecret />
    </AnalyticsArea>
  );
}

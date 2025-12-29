import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import type {SelectOption} from 'sentry/components/core/compactSelect/types';
import {ExternalLink} from 'sentry/components/core/link';
import {Select} from 'sentry/components/core/select';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import IdBadge from 'sentry/components/idBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NarrowLayout from 'sentry/components/narrowLayout';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {Integration, IntegrationProvider} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {generateOrgSlugUrl, urlEncode} from 'sentry/utils';
import type {IntegrationAnalyticsKey} from 'sentry/utils/analytics/integrations';
import {
  getIntegrationFeatureGate,
  trackIntegrationAnalytics,
} from 'sentry/utils/integrationUtil';
import {singleLineRenderer} from 'sentry/utils/marked/marked';
import {useApiQuery} from 'sentry/utils/queryClient';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import RouteError from 'sentry/views/routeError';
import AddIntegration from 'sentry/views/settings/organizationIntegrations/addIntegration';
import IntegrationLayout from 'sentry/views/settings/organizationIntegrations/detailedView/integrationLayout';

interface GitHubIntegrationInstallation {
  account: {
    login: string;
    type: string;
  };
  sender: {
    id: number;
    login: string;
  };
}

function trackExternalAnalytics({
  eventName,
  startSession,
  organization,
  provider,
}: {
  eventName: IntegrationAnalyticsKey;
  organization: Organization | null;
  provider: IntegrationProvider | null;
  startSession?: boolean;
}) {
  if (!organization || !provider) {
    return;
  }

  trackIntegrationAnalytics(
    eventName,
    {
      integration_type: 'first_party',
      integration: provider.key,
      // We actually don't know if it's installed but neither does the user in the view and multiple installs is possible
      already_installed: false,
      view: 'external_install',
      organization,
    },
    {startSession: !!startSession}
  );
}

export default function IntegrationOrganizationLink() {
  const location = useLocation();
  const {integrationSlug, installationId} = useParams<{
    integrationSlug: string;
    // installationId present for Github flow
    installationId?: string;
  }>();
  const [selectedOrgSlug, setSelectedOrgSlug] = useState<string | null>(null);

  const {
    data: organizations = [],
    isPending: isPendingOrganizations,
    error: organizationsError,
  } = useApiQuery<Organization[]>(
    ['/organizations/', {query: {include_feature_flags: 1}}],
    {staleTime: Infinity}
  );

  const isOrganizationQueryEnabled = !!selectedOrgSlug;
  const organizationQuery = useApiQuery<Organization>(
    [`/organizations/${selectedOrgSlug}/`, {query: {include_feature_flags: 1}}],
    {staleTime: Infinity, enabled: isOrganizationQueryEnabled}
  );
  const organization = organizationQuery.data ?? null;
  useEffect(() => {
    if (isOrganizationQueryEnabled && organizationQuery.error) {
      addErrorMessage(t('Failed to retrieve organization details'));
    }
  }, [isOrganizationQueryEnabled, organizationQuery.error]);

  const isProviderQueryEnabled = !!selectedOrgSlug;
  const providerQuery = useApiQuery<{
    providers: IntegrationProvider[];
  }>(
    [
      `/organizations/${selectedOrgSlug}/config/integrations/`,
      {query: {provider_key: integrationSlug}},
    ],
    {staleTime: Infinity, enabled: isProviderQueryEnabled}
  );
  const provider = providerQuery.data?.providers[0] ?? null;
  useEffect(() => {
    const hasEmptyProvider = !provider && !providerQuery.isPending;
    if (isProviderQueryEnabled && (providerQuery.error || hasEmptyProvider)) {
      addErrorMessage(t('Failed to retrieve integration details'));
    }
  }, [isProviderQueryEnabled, providerQuery.error, providerQuery.isPending, provider]);

  const isInstallationQueryEnabled = !!installationId && integrationSlug === 'github';
  const installationQuery = useApiQuery<GitHubIntegrationInstallation>(
    [`/../../extensions/github/installation/${installationId}/`],
    {staleTime: Infinity, enabled: isInstallationQueryEnabled}
  );
  const installationData = installationQuery.data ?? null;

  useEffect(() => {
    if (isInstallationQueryEnabled && installationQuery.error) {
      addErrorMessage(t('Failed to retrieve GitHub installation details'));
    }
  }, [isInstallationQueryEnabled, installationQuery.error]);

  // These two queries are recomputed when an organization is selected
  const isPendingSelection =
    (isOrganizationQueryEnabled && organizationQuery.isPending) ||
    (isProviderQueryEnabled && providerQuery.isPending);

  const selectOrganization = useCallback(
    (orgSlug: string) => {
      const customerDomain = ConfigStore.get('customerDomain');
      // redirect to the org if it's different than the org being selected
      if (customerDomain?.subdomain && orgSlug !== customerDomain?.subdomain) {
        const urlWithQuery = generateOrgSlugUrl(orgSlug) + location.search;
        testableWindowLocation.assign(urlWithQuery);
        return;
      }
      // otherwise proceed as normal
      setSelectedOrgSlug(orgSlug);
    },
    [location.search]
  );

  useEffect(() => {
    // If only one organization, select it and redirect
    if (organizations.length === 1) {
      selectOrganization((organizations[0] as Organization).slug);
    }
    // Now, check the subdomain and use that org slug if it exists
    const customerDomain = ConfigStore.get('customerDomain');
    if (customerDomain?.subdomain) {
      selectOrganization(customerDomain.subdomain);
    }
  }, [organizations, location.search, selectOrganization]);

  const hasAccess = useMemo(() => {
    return organization?.access.includes('org:integrations');
  }, [organization]);

  // used with Github to redirect to the integration detail
  const onInstallWithInstallationId = useCallback(
    (data: Integration) => {
      const orgId = organization?.slug;
      const normalizedUrl = normalizeUrl(
        `/settings/${orgId}/integrations/${data.provider.key}/${data.id}/`
      );
      window.location.assign(
        `${organization?.links.organizationUrl || ''}${normalizedUrl}`
      );
    },
    [organization]
  );

  // non-Github redirects to the extension view where the backend will finish the installation
  const finishInstallation = useCallback(() => {
    // add the selected org to the query parameters and then redirect back to configure
    const query = {orgSlug: selectedOrgSlug, ...location.query};
    trackExternalAnalytics({
      eventName: 'integrations.installation_start',
      organization,
      provider,
    });
    // need to send to control silo to finish the installation
    window.location.assign(
      `${organization?.links.organizationUrl || ''}/extensions/${
        integrationSlug
      }/configure/?${urlEncode(query)}`
    );
  }, [integrationSlug, location.query, organization, provider, selectedOrgSlug]);

  const renderAddButton = useMemo(() => {
    if (!provider || !organization) {
      return null;
    }
    const {features} = provider.metadata;

    // Prepare the features list
    const featuresComponents = features.map(f => ({
      featureGate: f.featureGate,
      description: (
        <FeatureListItem
          dangerouslySetInnerHTML={{__html: singleLineRenderer(f.description)}}
        />
      ),
    }));

    const {IntegrationFeatures} = getIntegrationFeatureGate();

    // Github uses a different installation flow with the installationId as a parameter
    // We have to wrap our installation button with AddIntegration so we can get the
    // addIntegrationWithInstallationId callback.
    // if we don't have an installationId, we need to use the finishInstallation callback.
    return (
      <IntegrationFeatures organization={organization} features={featuresComponents}>
        {({disabled, disabledReason}) => (
          <AddIntegration
            provider={provider}
            onInstall={onInstallWithInstallationId}
            organization={organization}
          >
            {addIntegrationWithInstallationId => (
              <ButtonWrapper>
                <Button
                  priority="primary"
                  disabled={!hasAccess || disabled}
                  onClick={() =>
                    installationId
                      ? addIntegrationWithInstallationId({
                          installation_id: installationId,
                        })
                      : finishInstallation()
                  }
                >
                  {t('Install %s', provider.name)}
                </Button>
                {disabled && <IntegrationLayout.DisabledNotice reason={disabledReason} />}
              </ButtonWrapper>
            )}
          </AddIntegration>
        )}
      </IntegrationFeatures>
    );
  }, [
    installationId,
    provider,
    organization,
    hasAccess,
    onInstallWithInstallationId,
    finishInstallation,
  ]);

  const renderBottom = useMemo(() => {
    const {FeatureList} = getIntegrationFeatureGate();

    if (isPendingSelection) {
      return <LoadingIndicator />;
    }

    return (
      <Fragment>
        {selectedOrgSlug && organization && !hasAccess && (
          <Alert.Container>
            <Alert type="danger">
              <p>
                {tct(
                  `You do not have permission to install integrations in
                [organization]. Ask an organization owner or manager to
                visit this page to finish installing this integration.`,
                  {organization: <strong>{organization.slug}</strong>}
                )}
              </p>
              <InstallLink>{generateOrgSlugUrl(selectedOrgSlug)}</InstallLink>
            </Alert>
          </Alert.Container>
        )}

        {provider && organization && hasAccess && FeatureList && (
          <Fragment>
            <p>
              {tct(
                'The following features will be available for [organization] when installed.',
                {organization: <strong>{organization.slug}</strong>}
              )}
            </p>
            <FeatureList
              organization={organization}
              features={provider.metadata.features}
              provider={provider}
            />
          </Fragment>
        )}
        <div className="form-actions">{renderAddButton}</div>
      </Fragment>
    );
  }, [
    isPendingSelection,
    hasAccess,
    provider,
    organization,
    renderAddButton,
    selectedOrgSlug,
  ]);

  const renderCallout = useCallback(() => {
    if (integrationSlug !== 'github') {
      return null;
    }

    if (!installationData) {
      return (
        <Alert.Container>
          <Alert type="warning">
            {t(
              'We could not verify the authenticity of the installation request. We recommend restarting the installation process.'
            )}
          </Alert>
        </Alert.Container>
      );
    }

    const sender_url = `https://github.com/${installationData?.sender.login}`;
    const target_url = `https://github.com/${installationData?.account.login}`;

    const alertText = tct(
      `GitHub user [sender_login] has installed GitHub app to [account_type] [account_login]. Proceed if you want to attach this installation to your Sentry account.`,
      {
        account_type: <strong>{installationData?.account.type}</strong>,
        account_login: (
          <strong>
            <ExternalLink href={target_url}>
              {installationData?.account.login}
            </ExternalLink>
          </strong>
        ),
        sender_id: <strong>{installationData?.sender.id}</strong>,
        sender_login: (
          <strong>
            <ExternalLink href={sender_url}>
              {installationData?.sender.login}
            </ExternalLink>
          </strong>
        ),
      }
    );

    return (
      <Alert.Container>
        <Alert type="info">{alertText}</Alert>
      </Alert.Container>
    );
  }, [integrationSlug, installationData]);

  if (isPendingOrganizations) {
    return <LoadingIndicator />;
  }

  if (organizationsError) {
    return <RouteError error={organizationsError} />;
  }

  const options = organizations.map((org: Organization) => ({
    value: org.slug,
    label: (
      <IdBadge
        organization={org}
        avatarSize={20}
        displayName={org.name}
        avatarProps={{consistentWidth: true}}
      />
    ),
  }));

  return (
    <NarrowLayout>
      <SentryDocumentTitle title={t('Choose Installation Organization')} />
      <h3>{t('Finish integration installation')}</h3>
      {renderCallout()}
      <p>
        {tct(
          `Please pick a specific [organization:organization] to link with
          your integration installation of [integation].`,
          {
            organization: <strong />,
            integation: <strong>{integrationSlug}</strong>,
          }
        )}
      </p>
      <FieldGroup label={t('Organization')} inline={false} stacked required>
        <Select
          onChange={(option: SelectOption<string>) => selectOrganization(option.value)}
          value={selectedOrgSlug}
          placeholder={t('Select an organization')}
          options={options}
        />
      </FieldGroup>
      {renderBottom}
    </NarrowLayout>
  );
}

const InstallLink = styled('pre')`
  margin-bottom: 0;
  background: #fbe3e1;
`;

const FeatureListItem = styled('span')`
  line-height: 24px;
`;

const ButtonWrapper = styled('div')`
  margin-left: auto;
  align-self: center;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

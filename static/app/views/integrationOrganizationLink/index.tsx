import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';
import {skipToken, useQuery} from '@tanstack/react-query';
import * as qs from 'query-string';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import type {SelectOption} from '@sentry/scraps/compactSelect';
import {Stack} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {FieldGroup} from 'sentry/components/forms/fieldGroup';
import {IdBadge} from 'sentry/components/idBadge';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {NarrowLayout} from 'sentry/components/narrowLayout';
import {
  getPipelineDefinition,
  type ProvidersByType,
} from 'sentry/components/pipeline/registry';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {TextCopyInput} from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import type {Integration, IntegrationProvider} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {generateOrgSlugUrl} from 'sentry/utils';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useAddIntegration} from 'sentry/utils/integrations/useAddIntegration';
import {getIntegrationFeatureGate} from 'sentry/utils/integrationUtil';
import {singleLineRenderer} from 'sentry/utils/marked/marked';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import {RouteError} from 'sentry/views/routeError';
import {IntegrationLayout} from 'sentry/views/settings/organizationIntegrations/detailedView/integrationLayout';

import {GitHubInstallationCallout} from './gitHubInstallationCallout';

/**
 * Landing page that completes an integration install initiated from a
 * third-party "app directory" or marketplace listing. After the user authorizes
 * on the provider side, the provider redirects here so the user can pick which
 * Sentry organization the install should land in, and then the install
 * pipeline is driven with the params the provider supplied.
 *
 * Provider-initiated entry points handled here:
 *
 *  - GitHub
 *    `/extensions/github/link/?installationId=...` (redirected from
 *    `/extensions/external-install/github/:installationId`). Drives the
 *    pipeline with `gitHubAppListingParams`.
 *
 *  - Discord
 *    `/extensions/discord/link/?code=...&guild_id=...` (redirected from
 *    `/extensions/discord/configure/`). Drives the pipeline with
 *    `discordAppDirectoryParams`.
 *
 *  - Microsoft Teams
 *    `/extensions/msteams/link/?signed_params=...` (redirected from
 *    `/extensions/msteams/configure/`). Drives the pipeline with
 *    `msTeamsParams`.
 *
 *  - Jira
 *    `/extensions/jira/link/?signed_params=...` (redirected from
 *    `/extensions/jira/configure/`). Drives the pipeline with
 *    `jiraParams`.
 *
 *  - Vercel
 *    `/extensions/vercel/link/...` (redirected from
 *    `/extensions/vercel/configure/`). Drives the pipeline with
 *    `vercelParams`.
 *
 *  - Azure DevOps (VSTS Marketplace)
 *    `/extensions/vsts/link/?targetId=...` (redirected from
 *    `/extensions/vsts/configure/`). Drives the `vsts` pipeline with
 *    `vstsParams`.
 *
 * Every install routes through the API-driven pipeline modal. Providers without
 * provider-supplied params just start the flow with no `urlParams`. A provider
 * with no registered pipeline is treated as an invalid flow: the error is
 * reported to Sentry and an inline error is shown instead of an install button.
 */
export default function IntegrationOrganizationLink() {
  const location = useLocation();
  const {integrationSlug} = useParams<{integrationSlug: string}>();
  // GitHub installs forwarded here from `/extensions/external-install/...`
  // carry `installationId` in the query string.
  const installationId =
    typeof location.query.installationId === 'string'
      ? location.query.installationId
      : undefined;
  const [selectedOrgSlug, setSelectedOrgSlug] = useState<string | null>(null);

  const {
    data: organizations = [],
    isPending: isPendingOrganizations,
    error: organizationsError,
  } = useQuery(apiOptions.as<Organization[]>()('/organizations/', {staleTime: Infinity}));

  const hasSelectedOrg = !!selectedOrgSlug;
  const organizationQuery = useQuery(
    apiOptions.as<Organization>()('/organizations/$organizationIdOrSlug/', {
      path: hasSelectedOrg ? {organizationIdOrSlug: selectedOrgSlug} : skipToken,
      query: {include_feature_flags: 1},
      staleTime: Infinity,
    })
  );
  const organization = organizationQuery.data ?? null;
  useEffect(() => {
    if (hasSelectedOrg && organizationQuery.error) {
      addErrorMessage(t('Failed to retrieve organization details'));
    }
  }, [hasSelectedOrg, organizationQuery.error]);

  const providerQuery = useQuery(
    apiOptions.as<{providers: IntegrationProvider[]}>()(
      '/organizations/$organizationIdOrSlug/config/integrations/',
      {
        path: hasSelectedOrg ? {organizationIdOrSlug: selectedOrgSlug} : skipToken,
        query: {provider_key: integrationSlug},
        staleTime: Infinity,
      }
    )
  );

  const provider = providerQuery.data?.providers[0] ?? null;

  useEffect(() => {
    const hasEmptyProvider = !provider && !providerQuery.isPending;
    if (hasSelectedOrg && (providerQuery.error || hasEmptyProvider)) {
      addErrorMessage(t('Failed to retrieve integration details'));
    }
  }, [hasSelectedOrg, providerQuery.error, providerQuery.isPending, provider]);

  // These two queries are recomputed when an organization is selected
  const isPendingSelection =
    hasSelectedOrg && (organizationQuery.isPending || providerQuery.isPending);

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
      selectOrganization(organizations[0]!.slug);
    }
    // Now, check the subdomain and use that org slug if it exists
    const customerDomain = ConfigStore.get('customerDomain');
    if (customerDomain?.subdomain) {
      selectOrganization(customerDomain.subdomain);
    }
  }, [organizations, location.search, selectOrganization]);

  const hasAccess = organization?.access.includes('org:integrations');

  const {startFlow} = useAddIntegration();

  // Lands the user on the integration's settings page after a successful
  // API-driven install. Used as `startFlow`'s `onInstall` callback by both
  // the GitHub App listing and Discord App Directory entry points.
  const onInstall = useCallback(
    (data: Integration) => {
      const orgId = organization?.slug;
      const normalizedUrl = normalizeUrl(
        `/settings/${orgId}/integrations/${data.provider.key}/${data.id}/`
      );
      // Preserve the `next` param (e.g. Vercel's marketplace return URL) so the
      // integration's configure page can offer a "Complete on <provider>" link
      // back to where the install was initiated.
      const nextParam =
        typeof location.query.next === 'string' ? location.query.next : undefined;
      const search = nextParam ? `?${qs.stringify({next: nextParam})}` : '';
      testableWindowLocation.assign(
        `${organization?.links.organizationUrl || ''}${normalizedUrl}${search}`
      );
    },
    [organization, location.query.next]
  );

  // GitHub App listing installs arrive here with `installationId` as a URL
  // path segment. The install button uses this as `initialData` for the
  // pipeline modal.
  const gitHubAppListingParams = useMemo<Record<string, string> | null>(() => {
    if (integrationSlug !== 'github' || !installationId) {
      return null;
    }
    return {installation_id: installationId};
  }, [integrationSlug, installationId]);

  // Discord App Directory installs arrive here with `code` and `guild_id` in
  // the URL query (forwarded from `/extensions/discord/configure/`). The
  // install button uses these as `initialData` for the pipeline modal.
  const discordAppDirectoryParams = useMemo<Record<string, string> | null>(() => {
    if (integrationSlug !== 'discord') {
      return null;
    }
    const code = location.query.code;
    const guildId = location.query.guild_id;
    if (typeof code !== 'string' || typeof guildId !== 'string') {
      return null;
    }
    return {code, guild_id: guildId, use_configure: '1'};
  }, [integrationSlug, location.query]);

  // Microsoft Teams installs arrive here with `signed_params` in the URL query
  // (forwarded from `/extensions/msteams/configure/`). The install button uses
  // it as `initialData` for the pipeline modal.
  const msTeamsParams = useMemo<Record<string, string> | null>(() => {
    if (integrationSlug !== 'msteams') {
      return null;
    }
    const signedParams = location.query.signed_params;
    if (typeof signedParams !== 'string') {
      return null;
    }
    return {signedParams};
  }, [integrationSlug, location.query]);

  // Jira Cloud installs arrive here with `signed_params` in the URL query
  // (forwarded from `/extensions/jira/configure/`). The install button uses it
  // as `initialData` for the pipeline modal.
  const jiraParams = useMemo<Record<string, string> | null>(() => {
    if (integrationSlug !== 'jira') {
      return null;
    }
    const signedParams = location.query.signed_params;
    if (typeof signedParams !== 'string') {
      return null;
    }
    return {signedParams};
  }, [integrationSlug, location.query]);

  // Vercel marketplace installs arrive here (forwarded from
  // `/extensions/vercel/configure/`) with the OAuth `code` Vercel already
  // granted. The install pipeline exchanges that code, so we forward it as
  // initialData for the modal -- no second authorize round-trip.
  const vercelParams = useMemo<Record<string, string> | null>(() => {
    if (integrationSlug !== 'vercel') {
      return null;
    }
    const code = location.query.code;
    if (typeof code !== 'string') {
      return null;
    }
    return {code};
  }, [integrationSlug, location.query]);

  // Azure DevOps Marketplace installs arrive here with `targetId` in the URL
  // query (forwarded from `/extensions/vsts/configure/`). It identifies the
  // Azure DevOps organization to install; the `vsts` pipeline treats it as a
  // pre-selected account (verified against the user's memberships) and
  // auto-advances past account selection.
  const vstsParams = useMemo<Record<string, string> | null>(() => {
    if (integrationSlug !== 'vsts') {
      return null;
    }
    const targetId = location.query.targetId;
    if (typeof targetId !== 'string') {
      return null;
    }
    return {targetId};
  }, [integrationSlug, location.query]);

  // A flow is invalid when the resolved provider has no pipeline registered for
  // it. Every first-party provider should have one, so this only happens for an
  // unsupported provider landing on this page -- we surface it instead of
  // rendering a dead install button.
  const isInvalidFlow = useMemo(() => {
    if (!provider) {
      return false;
    }
    try {
      // `provider.key` is an unconstrained string; an unsupported provider has
      // no registered pipeline and `getPipelineDefinition` throws for it.
      getPipelineDefinition(
        'integration',
        provider.key as ProvidersByType['integration']
      );
      return false;
    } catch {
      return true;
    }
  }, [provider]);

  useEffect(() => {
    if (provider && isInvalidFlow) {
      Sentry.captureException(
        new Error(`No integration pipeline registered for ${provider.key}`)
      );
    }
  }, [provider, isInvalidFlow]);

  const handleInstallClick = useCallback(() => {
    if (!provider || !organization || isInvalidFlow) {
      return;
    }

    // Each provider-initiated entry point contributes its own params bag.
    // Whichever one is non-null is forwarded to the API pipeline modal as
    // initial data; otherwise the flow starts with no provider-supplied params.
    const urlParams =
      gitHubAppListingParams ??
      discordAppDirectoryParams ??
      msTeamsParams ??
      jiraParams ??
      vercelParams ??
      vstsParams ??
      undefined;

    startFlow({provider, organization, onInstall, urlParams});
  }, [
    provider,
    organization,
    isInvalidFlow,
    gitHubAppListingParams,
    discordAppDirectoryParams,
    msTeamsParams,
    jiraParams,
    vercelParams,
    vstsParams,
    startFlow,
    onInstall,
  ]);

  const renderAddButton = useMemo(() => {
    if (!provider || !organization) {
      return null;
    }

    if (isInvalidFlow) {
      return (
        <Alert.Container>
          <Alert variant="danger">
            {tct('Sentry does not support installing [provider] from this page.', {
              provider: <strong>{provider.name}</strong>,
            })}
          </Alert>
        </Alert.Container>
      );
    }

    const {features} = provider.metadata;

    // Prepare the features list
    const featuresComponents = features.map(f => ({
      featureGate: f.featureGate,
      description: (
        <Text density="comfortable">
          <span dangerouslySetInnerHTML={{__html: singleLineRenderer(f.description)}} />
        </Text>
      ),
    }));

    const {IntegrationFeatures} = getIntegrationFeatureGate();

    return (
      <IntegrationFeatures organization={organization} features={featuresComponents}>
        {({disabled, disabledReason}) => (
          <Stack align="center" justify="center">
            <Button
              variant="primary"
              disabled={!hasAccess || disabled}
              onClick={handleInstallClick}
            >
              {t('Install %s', provider.name)}
            </Button>
            {disabled && <IntegrationLayout.DisabledNotice reason={disabledReason} />}
          </Stack>
        )}
      </IntegrationFeatures>
    );
  }, [provider, organization, hasAccess, handleInstallClick, isInvalidFlow]);

  const renderBottom = useMemo(() => {
    const {FeatureList} = getIntegrationFeatureGate();

    if (isPendingSelection) {
      return <LoadingIndicator />;
    }

    return (
      <Fragment>
        {selectedOrgSlug && organization && !hasAccess && (
          <Alert.Container>
            <Alert variant="danger">
              <p>
                {tct(
                  `You do not have permission to install integrations in
                [organization]. Ask an organization owner or manager to
                visit this page to finish installing this integration.`,
                  {organization: <strong>{organization.slug}</strong>}
                )}
              </p>
              <TextCopyInput>{generateOrgSlugUrl(selectedOrgSlug)}</TextCopyInput>
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
      {integrationSlug === 'github' && installationId && (
        <GitHubInstallationCallout installationId={installationId} />
      )}
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

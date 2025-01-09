import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {fetchOrganizations} from 'sentry/actionCreators/organizations';
import {installSentryApp} from 'sentry/actionCreators/sentryAppInstallations';
import {Alert} from 'sentry/components/alert';
import OrganizationAvatar from 'sentry/components/avatar/organizationAvatar';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryAppDetailsModal from 'sentry/components/modals/sentryAppDetailsModal';
import NarrowLayout from 'sentry/components/narrowLayout';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {SentryApp, SentryAppInstallation} from 'sentry/types/integrations';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization, OrganizationSummary} from 'sentry/types/organization';
import {generateOrgSlugUrl} from 'sentry/utils';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import {useApiQuery} from 'sentry/utils/queryClient';
import {addQueryParamsToExistingUrl} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';

import {OrganizationContext} from '../organizationContext';

type Props = RouteComponentProps<{sentryAppSlug: string}, {}>;

// Page Layout
export default function SentryAppExternalInstallation(props: Props) {
  return (
    <NarrowLayout>
      <Content>
        <h3>{t('Finish integration installation')}</h3>
        <SentryAppExternalInstallationContent {...props} />
      </Content>
    </NarrowLayout>
  );
}

// View Contents
function SentryAppExternalInstallationContent({params, ...props}: Props) {
  const api = useApi();
  // The selected organization fetched from org details
  const [organization, setOrganization] = useState<Organization>();
  // The selected organization's slug. Should be removed as we have the selected organization as well.
  const [selectedOrgSlug, setSelectedOrgSlug] = useState<string>();

  const [organizations, setOrganizations] = useState<Array<OrganizationSummary>>([]);
  const [orgsLoading, setOrgsLoading] = useState<boolean>(true);
  const [isInstalled, setIsInstalled] = useState<boolean>();

  // Load data on mount.
  const {data: sentryApp, isPending: sentryAppLoading} = useApiQuery<SentryApp>(
    [`/sentry-apps/${params.sentryAppSlug}/`],
    {
      staleTime: 0,
    }
  );

  useEffect(
    function () {
      async function loadOrgs() {
        try {
          const orgs = await fetchOrganizations(api);
          setOrganizations(orgs);
          setOrgsLoading(false);
        } catch (e) {
          setOrgsLoading(false);
          // Do nothing.
        }
      }
      loadOrgs();
    },
    [api]
  );

  const onSelectOrg = useCallback(
    async function (orgSlug: string) {
      const customerDomain = ConfigStore.get('customerDomain');
      // redirect to the org if it's different than the org being selected
      if (customerDomain?.subdomain && orgSlug !== customerDomain?.subdomain) {
        const urlWithQuery = generateOrgSlugUrl(orgSlug) + props.location.search;
        window.location.assign(urlWithQuery);
        return;
      }
      // otherwise proceed as normal
      setSelectedOrgSlug(orgSlug);

      try {
        const [org, installations]: [Organization, SentryAppInstallation[]] =
          await Promise.all([
            api.requestPromise(`/organizations/${orgSlug}/`, {
              query: {
                include_feature_flags: 1,
              },
            }),
            api.requestPromise(`/organizations/${orgSlug}/sentry-app-installations/`),
          ]);
        const installed = installations
          .map(install => install.app.slug)
          .includes(params.sentryAppSlug);

        setOrganization(org);
        setSelectedOrgSlug(org.slug);
        setIsInstalled(installed);
      } catch (err) {
        addErrorMessage(t('Failed to retrieve organization or integration details'));
      }
    },
    [
      api,
      params.sentryAppSlug,
      props.location.search,
      setOrganization,
      setSelectedOrgSlug,
      setIsInstalled,
    ]
  );

  useEffect(function () {
    // Skip if we have a selected org, or if there aren't any orgs loaded yet.
    if (organization || organizations.length < 1) {
      return;
    }
    if (organizations.length === 1) {
      // auto select the org if there is only one
      onSelectOrg(organizations[0]!.slug);
    }

    // now check the subomdain and use that org slug if it exists
    const customerDomain = ConfigStore.get('customerDomain');
    if (customerDomain?.subdomain) {
      onSelectOrg(customerDomain.subdomain);
    }
  });

  const onClose = useCallback(() => {
    // if we came from somewhere, go back there. Otherwise, back to the integrations page
    const newUrl = document.referrer || `/settings/${selectedOrgSlug}/integrations/`;
    window.location.assign(newUrl);
  }, [selectedOrgSlug]);

  const disableInstall = useCallback(
    function () {
      if (!(sentryApp && selectedOrgSlug)) {
        return false;
      }
      return isInstalled || isSentryAppUnavailableForOrg(sentryApp, selectedOrgSlug);
    },
    [isInstalled, selectedOrgSlug, sentryApp]
  );

  const onInstall = useCallback(async (): Promise<any | undefined> => {
    if (!organization || !sentryApp) {
      return undefined;
    }
    trackIntegrationAnalytics('integrations.installation_start', {
      integration_type: 'sentry_app',
      integration: sentryApp.slug,
      view: 'external_install',
      integration_status: sentryApp.status,
      organization,
    });

    const install = await installSentryApp(api, organization.slug, sentryApp);
    // installation is complete if the status is installed
    if (install.status === 'installed') {
      trackIntegrationAnalytics('integrations.installation_complete', {
        integration_type: 'sentry_app',
        integration: sentryApp.slug,
        view: 'external_install',
        integration_status: sentryApp.status,
        organization,
      });
    }

    if (sentryApp.redirectUrl) {
      const queryParams: Record<string, string | undefined> = {
        installationId: install.uuid,
        code: install.code,
        orgSlug: organization.slug,
      };
      const state = props.location.query.state;
      if (state) {
        queryParams.state = state;
      }
      const redirectUrl = addQueryParamsToExistingUrl(sentryApp.redirectUrl, queryParams);
      return window.location.assign(redirectUrl);
    }
    return onClose();
  }, [api, organization, sentryApp, onClose, props.location.query.state]);

  if (sentryAppLoading || orgsLoading || !sentryApp) {
    return <LoadingIndicator />;
  }

  return (
    <div>
      <OrgViewHolder>
        {isSingleOrg(organizations) ? (
          <SingleOrgView organizations={organizations} sentryApp={sentryApp} />
        ) : (
          <MultiOrgView
            onSelectOrg={onSelectOrg}
            organizations={organizations}
            selectedOrgSlug={selectedOrgSlug}
            sentryApp={sentryApp}
          />
        )}
      </OrgViewHolder>
      <CheckAndRenderError
        organization={organization}
        selectedOrgSlug={selectedOrgSlug}
        isInstalled={isInstalled}
        sentryApp={sentryApp}
      />
      {organization && (
        <OrganizationContext.Provider value={organization}>
          <SentryAppDetailsModal
            sentryApp={sentryApp}
            organization={organization}
            onInstall={onInstall}
            closeModal={onClose}
            isInstalled={disableInstall()}
          />
        </OrganizationContext.Provider>
      )}
    </div>
  );
}

type CheckAndRenderProps = {
  isInstalled: boolean | undefined;
  organization: Organization | undefined;
  selectedOrgSlug: string | undefined;
  sentryApp: SentryApp;
};

function CheckAndRenderError({
  organization,
  selectedOrgSlug,
  isInstalled,
  sentryApp,
}: CheckAndRenderProps) {
  if (selectedOrgSlug && organization && !hasAccess(organization)) {
    return (
      <Alert type="error" showIcon>
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
    );
  }

  if (isInstalled && organization && sentryApp) {
    return (
      <Alert type="error" showIcon>
        {tct('Integration [sentryAppName] already installed for [organization]', {
          organization: <strong>{organization.name}</strong>,
          sentryAppName: <strong>{sentryApp.name}</strong>,
        })}
      </Alert>
    );
  }

  if (isSentryAppUnavailableForOrg(sentryApp, selectedOrgSlug)) {
    // use the slug of the owner if we have it, otherwise use 'another organization'
    const ownerSlug = sentryApp?.owner?.slug ?? 'another organization';
    return (
      <Alert type="error" showIcon>
        {tct(
          'Integration [sentryAppName] is an unpublished integration for [otherOrg]. An unpublished integration can only be installed on the organization which created it.',
          {
            sentryAppName: <strong>{sentryApp.name}</strong>,
            otherOrg: <strong>{ownerSlug}</strong>,
          }
        )}
      </Alert>
    );
  }

  return null;
}

type SingleOrgProps = {
  organizations: Array<OrganizationSummary>;
  sentryApp: SentryApp;
};
function SingleOrgView({organizations, sentryApp}: SingleOrgProps) {
  const organizationName = organizations[0]!.name;
  return (
    <div>
      <p>
        {tct('You are installing [sentryAppName] for organization [organization]', {
          organization: <strong>{organizationName}</strong>,
          sentryAppName: <strong>{sentryApp.name}</strong>,
        })}
      </p>
    </div>
  );
}

type SelectOrgCallback = (slug: string) => void;

type MultiOrgProps = {
  onSelectOrg: SelectOrgCallback;
  organizations: Array<OrganizationSummary>;
  selectedOrgSlug: string | undefined;
  sentryApp: SentryApp;
};
function MultiOrgView({
  onSelectOrg,
  organizations,
  selectedOrgSlug,
  sentryApp,
}: MultiOrgProps) {
  return (
    <div>
      <p>
        {tct(
          'Please pick a specific [organization:organization] to install [sentryAppName]',
          {
            organization: <strong />,
            sentryAppName: <strong>{sentryApp.name}</strong>,
          }
        )}
      </p>
      <FieldGroup label={t('Organization')} inline={false} stacked required>
        <SelectControl
          onChange={({value}) => onSelectOrg(value)}
          value={selectedOrgSlug}
          placeholder={t('Select an organization')}
          options={getOrganizationOptions(organizations)}
          data-test-id="org-select"
        />
      </FieldGroup>
    </div>
  );
}

const hasAccess = (org: Organization) => org.access.includes('org:integrations');

function isSingleOrg(organizations: Array<OrganizationSummary>): boolean {
  return organizations.length === 1;
}

function getOrganizationOptions(organizations: Array<OrganizationSummary>) {
  return organizations.map(org => ({
    value: org.slug,
    label: (
      <div key={org.slug}>
        <OrganizationAvatar organization={org} />
        <OrgNameHolder>{org.slug}</OrgNameHolder>
      </div>
    ),
  }));
}

function isSentryAppUnavailableForOrg(
  sentryApp: SentryApp,
  selectedOrgSlug: string | undefined
): boolean {
  if (!selectedOrgSlug) {
    return false;
  }
  // if the app is unpublished for a different org
  return sentryApp?.owner?.slug !== selectedOrgSlug && sentryApp.status === 'unpublished';
}

const InstallLink = styled('pre')`
  margin-bottom: 0;
  background: #fbe3e1;
`;

const OrgNameHolder = styled('span')`
  margin-left: 5px;
`;

const Content = styled('div')`
  margin-bottom: 40px;
`;

const OrgViewHolder = styled('div')`
  margin-bottom: 20px;
`;

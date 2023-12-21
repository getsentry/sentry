import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {urlEncode} from '@sentry/utils';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import IdBadge from 'sentry/components/idBadge';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NarrowLayout from 'sentry/components/narrowLayout';
import {t, tct} from 'sentry/locale';
import {Integration, IntegrationProvider, Organization} from 'sentry/types';
import {generateBaseControlSiloUrl, generateOrgSlugUrl} from 'sentry/utils';
import {IntegrationAnalyticsKey} from 'sentry/utils/analytics/integrations';
import {
  getIntegrationFeatureGate,
  trackIntegrationAnalytics,
} from 'sentry/utils/integrationUtil';
import {singleLineRenderer} from 'sentry/utils/marked';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';
import {DisabledNotice} from 'sentry/views/settings/organizationIntegrations/abstractIntegrationDetailedView';
import AddIntegration from 'sentry/views/settings/organizationIntegrations/addIntegration';

// installationId present for Github flow
type Props = RouteComponentProps<{integrationSlug: string; installationId?: string}, {}>;

type State = DeprecatedAsyncView['state'] & {
  installationData?: GitHubIntegrationInstallation;
  installationDataLoading?: boolean;
  organization?: Organization;
  provider?: IntegrationProvider;
  selectedOrgSlug?: string;
};

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

export default class IntegrationOrganizationLink extends DeprecatedAsyncView<
  Props,
  State
> {
  disableErrorReport = false;
  controlSiloApi = new Client({baseUrl: generateBaseControlSiloUrl() + '/api/0'});

  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
    return [['organizations', '/organizations/']];
  }

  getTitle() {
    return t('Choose Installation Organization');
  }

  trackIntegrationAnalytics = (
    eventName: IntegrationAnalyticsKey,
    startSession?: boolean
  ) => {
    const {organization, provider} = this.state;
    // should have these set but need to make TS happy
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
  };

  trackOpened() {
    this.trackIntegrationAnalytics('integrations.integration_viewed', true);
  }

  trackInstallationStart() {
    this.trackIntegrationAnalytics('integrations.installation_start');
  }

  get integrationSlug() {
    return this.props.params.integrationSlug;
  }

  get queryParams() {
    return this.props.location.query;
  }

  getOrgBySlug = (orgSlug: string): Organization | undefined => {
    return this.state.organizations.find((org: Organization) => org.slug === orgSlug);
  };

  onLoadAllEndpointsSuccess() {
    // auto select the org if there is only one
    const {organizations} = this.state;
    if (organizations.length === 1) {
      this.onSelectOrg({value: organizations[0].slug});
    }
  }

  onSelectOrg = async ({value: orgSlug}: {value: string}) => {
    this.setState({selectedOrgSlug: orgSlug, reloading: true, organization: undefined});

    try {
      const [organization, {providers}]: [
        Organization,
        {providers: IntegrationProvider[]},
      ] = await Promise.all([
        this.controlSiloApi.requestPromise(`/organizations/${orgSlug}/`),
        this.controlSiloApi.requestPromise(
          `/organizations/${orgSlug}/config/integrations/?provider_key=${this.integrationSlug}`
        ),
      ]);
      // should never happen with a valid provider
      if (providers.length === 0) {
        throw new Error('Invalid provider');
      }

      let installationData = undefined;
      if (this.integrationSlug === 'github') {
        const {installationId} = this.props.params;
        try {
          // The API endpoint /extensions/github/installation is not prefixed with /api/0
          // so we have to use this workaround.
          installationData = await this.controlSiloApi.requestPromise(
            `/../../extensions/github/installation/${installationId}/`
          );
        } catch (_err) {
          addErrorMessage(t('Failed to retrieve GitHub installation details'));
        }
        this.setState({installationDataLoading: false});
      }

      this.setState(
        {organization, reloading: false, provider: providers[0], installationData},
        this.trackOpened
      );
    } catch (_err) {
      addErrorMessage(t('Failed to retrieve organization or integration details'));
      this.setState({reloading: false});
    }
  };

  hasAccess = () => {
    const {organization} = this.state;
    return organization?.access.includes('org:integrations');
  };

  // used with Github to redirect to the the integration detail
  onInstallWithInstallationId = (data: Integration) => {
    const {organization} = this.state;
    const orgId = organization && organization.slug;
    const normalizedUrl = normalizeUrl(
      `/settings/${orgId}/integrations/${data.provider.key}/${data.id}/`
    );
    window.location.assign(
      `${organization?.links.organizationUrl || ''}${normalizedUrl}`
    );
  };

  // non-Github redirects to the extension view where the backend will finish the installation
  finishInstallation = () => {
    // add the selected org to the query parameters and then redirect back to configure
    const {selectedOrgSlug, organization} = this.state;
    const query = {orgSlug: selectedOrgSlug, ...this.queryParams};
    this.trackInstallationStart();
    // need to send to control silo to finish the installation
    window.location.assign(
      `${organization?.links.organizationUrl || ''}/extensions/${
        this.integrationSlug
      }/configure/?${urlEncode(query)}`
    );
  };

  renderAddButton() {
    const {installationId} = this.props.params;
    const {organization, provider} = this.state;
    // should never happen but we need this check for TS
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
            onInstall={this.onInstallWithInstallationId}
            organization={organization}
          >
            {addIntegrationWithInstallationId => (
              <ButtonWrapper>
                <Button
                  priority="primary"
                  disabled={!this.hasAccess() || disabled}
                  onClick={() =>
                    installationId
                      ? addIntegrationWithInstallationId({
                          installation_id: installationId,
                        })
                      : this.finishInstallation()
                  }
                >
                  {t('Install %s', provider.name)}
                </Button>
                {disabled && <DisabledNotice reason={disabledReason} />}
              </ButtonWrapper>
            )}
          </AddIntegration>
        )}
      </IntegrationFeatures>
    );
  }

  renderBottom() {
    const {organization, selectedOrgSlug, provider, reloading} = this.state;
    const {FeatureList} = getIntegrationFeatureGate();
    if (reloading) {
      return <LoadingIndicator />;
    }

    return (
      <Fragment>
        {selectedOrgSlug && organization && !this.hasAccess() && (
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
        )}

        {provider && organization && this.hasAccess() && FeatureList && (
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

        <div className="form-actions">{this.renderAddButton()}</div>
      </Fragment>
    );
  }

  renderCallout() {
    const {installationData, installationDataLoading} = this.state;

    if (this.integrationSlug !== 'github') {
      return null;
    }

    if (!installationData) {
      if (installationDataLoading !== false) {
        return null;
      }

      return (
        <Alert type="warning" showIcon>
          {t(
            'We could not verify the authenticity of the installation request. We recommend restarting the installation process.'
          )}
        </Alert>
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
      <Alert type="info" showIcon>
        {alertText}
      </Alert>
    );
  }

  renderBody() {
    const {selectedOrgSlug} = this.state;
    const options = this.state.organizations.map((org: Organization) => ({
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
        <h3>{t('Finish integration installation')}</h3>
        {this.renderCallout()}
        <p>
          {tct(
            `Please pick a specific [organization:organization] to link with
            your integration installation of [integation].`,
            {
              organization: <strong />,
              integation: <strong>{this.integrationSlug}</strong>,
            }
          )}
        </p>

        <FieldGroup label={t('Organization')} inline={false} stacked required>
          <SelectControl
            onChange={this.onSelectOrg}
            value={selectedOrgSlug}
            placeholder={t('Select an organization')}
            options={options}
          />
        </FieldGroup>
        {this.renderBottom()}
      </NarrowLayout>
    );
  }
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
  line-height: 24px;
`;

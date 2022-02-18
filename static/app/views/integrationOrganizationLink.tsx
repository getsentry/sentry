import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import {components} from 'react-select';
import styled from '@emotion/styled';
import {urlEncode} from '@sentry/utils';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import Field from 'sentry/components/forms/field';
import SelectControl from 'sentry/components/forms/selectControl';
import IdBadge from 'sentry/components/idBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NarrowLayout from 'sentry/components/narrowLayout';
import {IconFlag} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {Integration, IntegrationProvider, Organization} from 'sentry/types';
import {IntegrationAnalyticsKey} from 'sentry/utils/analytics/integrationAnalyticsEvents';
import {
  getIntegrationFeatureGate,
  trackIntegrationAnalytics,
} from 'sentry/utils/integrationUtil';
import {singleLineRenderer} from 'sentry/utils/marked';
import AsyncView from 'sentry/views/asyncView';
import AddIntegration from 'sentry/views/organizationIntegrations/addIntegration';

// installationId present for Github flow
type Props = RouteComponentProps<{integrationSlug: string; installationId?: string}, {}>;

type State = AsyncView['state'] & {
  organization?: Organization;
  provider?: IntegrationProvider;
  selectedOrgSlug?: string;
};

export default class IntegrationOrganizationLink extends AsyncView<Props, State> {
  disableErrorReport = false;

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
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
        {providers: IntegrationProvider[]}
      ] = await Promise.all([
        this.api.requestPromise(`/organizations/${orgSlug}/`),
        this.api.requestPromise(
          `/organizations/${orgSlug}/config/integrations/?provider_key=${this.integrationSlug}`
        ),
      ]);
      // should never happen with a valid provider
      if (providers.length === 0) {
        throw new Error('Invalid provider');
      }
      this.setState(
        {organization, reloading: false, provider: providers[0]},
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
    this.props.router.push(
      `/settings/${orgId}/integrations/${data.provider.key}/${data.id}/`
    );
  };

  // non-Github redirects to the extension view where the backend will finish the installation
  finishInstallation = () => {
    // add the selected org to the query parameters and then redirect back to configure
    const {selectedOrgSlug} = this.state;
    const query = {orgSlug: selectedOrgSlug, ...this.queryParams};
    this.trackInstallationStart();
    window.location.assign(
      `/extensions/${this.integrationSlug}/configure/?${urlEncode(query)}`
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

    const {IntegrationDirectoryFeatures} = getIntegrationFeatureGate();

    // Github uses a different installation flow with the installationId as a parameter
    // We have to wrap our installation button with AddIntegration so we can get the
    // addIntegrationWithInstallationId callback.
    // if we don't hve an installationId, we need to use the finishInstallation callback.
    return (
      <IntegrationDirectoryFeatures
        organization={organization}
        features={featuresComponents}
      >
        {({disabled}) => (
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
              </ButtonWrapper>
            )}
          </AddIntegration>
        )}
      </IntegrationDirectoryFeatures>
    );
  }

  customOption = orgProps => {
    const organization = this.getOrgBySlug(orgProps.value);
    if (!organization) {
      return null;
    }
    return (
      <components.Option {...orgProps}>
        <IdBadge
          organization={organization}
          avatarSize={20}
          displayName={organization.name}
          avatarProps={{consistentWidth: true}}
        />
      </components.Option>
    );
  };

  customValueContainer = containerProps => {
    const valueList = containerProps.getValue();
    // if no value set, we want to return the default component that is rendered
    if (valueList.length === 0) {
      return <components.ValueContainer {...containerProps} />;
    }
    const orgSlug = valueList[0].value;
    const organization = this.getOrgBySlug(orgSlug);
    if (!organization) {
      return <components.ValueContainer {...containerProps} />;
    }
    return (
      <components.ValueContainer {...containerProps}>
        <IdBadge
          organization={organization}
          avatarSize={20}
          displayName={organization.name}
          avatarProps={{consistentWidth: true}}
        />
      </components.ValueContainer>
    );
  };

  renderBottom() {
    const {organization, selectedOrgSlug, provider, reloading} = this.state;
    const {FeatureList} = getIntegrationFeatureGate();
    if (reloading) {
      return <LoadingIndicator />;
    }

    return (
      <Fragment>
        {selectedOrgSlug && organization && !this.hasAccess() && (
          <Alert type="error" icon={<IconFlag size="md" />}>
            <p>
              {tct(
                `You do not have permission to install integrations in
                [organization]. Ask an organization owner or manager to
                visit this page to finish installing this integration.`,
                {organization: <strong>{organization.slug}</strong>}
              )}
            </p>
            <InstallLink>{window.location.href}</InstallLink>
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

  renderBody() {
    const {selectedOrgSlug} = this.state;
    const options = this.state.organizations.map((org: Organization) => ({
      value: org.slug,
      label: org.name,
    }));

    return (
      <NarrowLayout>
        <h3>{t('Finish integration installation')}</h3>
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

        <Field label={t('Organization')} inline={false} stacked required>
          <SelectControl
            onChange={this.onSelectOrg}
            value={selectedOrgSlug}
            placeholder={t('Select an organization')}
            options={options}
            components={{
              Option: this.customOption,
              ValueContainer: this.customValueContainer,
            }}
          />
        </Field>
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
`;

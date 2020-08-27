import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';
import styled from '@emotion/styled';
import {urlEncode} from '@sentry/utils';
import {components} from 'react-select';

import {Organization, IntegrationProvider} from 'app/types';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {t, tct} from 'app/locale';
import {
  trackIntegrationEvent,
  getIntegrationFeatureGate,
  SingleIntegrationEvent,
} from 'app/utils/integrationUtil';
import {singleLineRenderer} from 'app/utils/marked';
import Alert from 'app/components/alert';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import Field from 'app/views/settings/components/forms/field';
import NarrowLayout from 'app/components/narrowLayout';
import SelectControl from 'app/components/forms/selectControl';
import IdBadge from 'app/components/idBadge';
import {IconFlag} from 'app/icons';
import LoadingIndicator from 'app/components/loadingIndicator';

//installationId present for Github flow
type Props = RouteComponentProps<{integrationSlug: string; installationId?: string}, {}>;

type State = AsyncView['state'] & {
  selectedOrgSlug?: string;
  organization?: Organization;
  provider?: IntegrationProvider;
};

export default class IntegrationOrganizationLink extends AsyncView<Props, State> {
  getEndpoints(): [string, string][] {
    return [['organizations', '/organizations/']];
  }

  getTitle() {
    return t('Choose Installation Organization');
  }

  trackIntegrationEvent = (
    options: Pick<SingleIntegrationEvent, 'eventKey' | 'eventName'>,
    startSession?: boolean
  ) => {
    const {organization, provider} = this.state;
    //should have these set but need to make TS happy
    if (!organization || !provider) {
      return;
    }

    trackIntegrationEvent(
      {
        ...options,
        integration_type: 'first_party',
        integration: provider.key,
        //We actually don't know if it's installed but neither does the user in the view and multiple installs is possible
        already_installed: false,
        view: 'external_install',
      },
      organization,
      {startSession: !!startSession}
    );
  };

  trackOpened() {
    this.trackIntegrationEvent(
      {
        eventKey: 'integrations.integration_viewed',
        eventName: 'Integrations: Integration Viewed',
      },
      true
    );
  }

  trackInstallationStart() {
    this.trackIntegrationEvent({
      eventKey: 'integrations.installation_start',
      eventName: 'Integrations: Installation Start',
    });
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
    //auto select the org if there is only one
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

  renderAddButton(onClick: React.ComponentProps<typeof Button>['onClick']) {
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

    return (
      <IntegrationDirectoryFeatures
        organization={organization}
        features={featuresComponents}
      >
        {({disabled}) => (
          <ButtonWrapper>
            <Button
              priority="primary"
              disabled={!this.hasAccess() || disabled}
              onClick={onClick}
            >
              {t('Install %s', provider.name)}
            </Button>
          </ButtonWrapper>
        )}
      </IntegrationDirectoryFeatures>
    );
  }

  renderAddButtonContainer() {
    // TOOD: Implement for Github
    if (this.props.params.installationId) {
      throw new Error('Not implemented yet');
    }
    return this.renderAddButton(() => {
      // add the selected org to the query parameters and then redirect back to configure
      const {selectedOrgSlug} = this.state;
      const query = {orgSlug: selectedOrgSlug, ...this.queryParams};
      this.trackInstallationStart();
      window.location.assign(
        `/extensions/${this.integrationSlug}/configure/?${urlEncode(query)}`
      );
    });
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
    //if no value set, we want to return the default component that is rendered
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
      <React.Fragment>
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
          <React.Fragment>
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
          </React.Fragment>
        )}

        <div className="form-actions">{this.renderAddButtonContainer()}</div>
      </React.Fragment>
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

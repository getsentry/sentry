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
} from 'app/utils/integrationUtil';
import Alert from 'app/components/alert';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import Field from 'app/views/settings/components/forms/field';
import NarrowLayout from 'app/components/narrowLayout';
import SelectControl from 'app/components/forms/selectControl';
import IdBadge from 'app/components/idBadge';

type Props = RouteComponentProps<{integrationSlug: string}, {}>;

type State = AsyncView['state'] & {
  selectedOrg?: string;
  organization?: Organization;
  provider?: IntegrationProvider;
};

//TODO: make generic props so we can use with Github external installation
export default class IntegrationInstallation extends AsyncView<Props, State> {
  getEndpoints(): [string, string][] {
    return [['organizations', '/organizations/']];
  }

  getTitle() {
    return t('Choose Installation Organization');
  }

  trackOpened() {
    const {organization, provider} = this.state;
    //should have these set but need to make TS happy
    if (!organization || !provider) {
      return;
    }

    trackIntegrationEvent(
      {
        eventKey: 'integrations.integration_viewed',
        eventName: 'Integrations: Integration Viewed',
        integration_type: 'first_party',
        integration: provider.key,
        //We actually don't know if it's installed but neither does the user in the view and multiple installs is possible
        already_installed: false,
        view: 'external_install',
      },
      organization,
      {startSession: true}
    );
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

  onSelectOrg = async ({value: orgSlug}: {value: string}) => {
    this.setState({selectedOrg: orgSlug, reloading: true, organization: undefined});

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

  hasAccess = (org: Organization) => org.access.includes('org:integrations');

  renderAddButton(p: React.ComponentProps<typeof Button>) {
    const {reloading} = this.state;
    //TODO: improve loading experience
    return (
      <Button priority="primary" busy={reloading} {...p}>
        Install Integration
      </Button>
    );
  }

  renderAddButtonContainer() {
    return this.renderAddButton({
      onClick: () => {
        const {selectedOrg} = this.state;
        const query = {orgSlug: selectedOrg, ...this.queryParams};
        window.location.assign(`/extensions/vercel/configure/?${urlEncode(query)}`);
      },
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

  renderBody() {
    const {organization, selectedOrg, provider} = this.state;
    const options = this.state.organizations.map((org: Organization) => ({
      value: org.slug,
      label: org.name,
    }));

    const {FeatureList} = getIntegrationFeatureGate();

    return (
      <NarrowLayout>
        <h3>{t('Finish integration installation')}</h3>
        <p>
          {tct(
            `Please pick a specific [organization:organization] to link with
            your integration installation.`,
            {
              organization: <strong />,
            }
          )}
        </p>

        {selectedOrg && organization && !this.hasAccess(organization) && (
          <Alert type="error" icon="icon-circle-exclamation">
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

        {provider && organization && this.hasAccess(organization) && FeatureList && (
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

        <Field label={t('Organization')} inline={false} stacked required>
          {() => (
            <SelectControl
              onChange={this.onSelectOrg}
              value={selectedOrg}
              placeholder={t('Select an organization')}
              options={options}
              components={{
                Option: this.customOption,
                ValueContainer: this.customValueContainer,
              }}
            />
          )}
        </Field>

        <div className="form-actions">{this.renderAddButtonContainer()}</div>
      </NarrowLayout>
    );
  }
}

const InstallLink = styled('pre')`
  margin-bottom: 0;
  background: #fbe3e1;
`;

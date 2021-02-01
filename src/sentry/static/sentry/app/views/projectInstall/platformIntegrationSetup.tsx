import 'prism-sentry/index.css';

import React from 'react';
import {browserHistory, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import platforms from 'app/data/platforms';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {IntegrationProvider, Organization} from 'app/types';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import AddIntegrationButton from 'app/views/organizationIntegrations/addIntegrationButton';

import PlatformFooter from './components/platformFooter';
import PlatformHeader from './components/platformHeader';

type Props = {
  api: Client;
  organization: Organization;
  integrationSlug: string;
} & WithRouterProps<{orgId: string; projectId: string; platform: string}, {}>;

type State = {
  loading: boolean;
  error: boolean;
  installed: boolean;
  provider: IntegrationProvider | null;
};

class PlatformIntegrationSetup extends React.Component<Props, State> {
  state: State = {
    loading: true,
    error: false,
    installed: true,
    provider: null,
  };

  componentDidMount() {
    this.fetchData();
    window.scrollTo(0, 0);

    const {platform} = this.props.params;

    //redirect if platform is not known.
    if (!platform || platform === 'other') {
      this.redirectToNeutralDocs();
    }
  }

  get isGettingStarted() {
    return window.location.href.indexOf('getting-started') > 0;
  }

  get manualSetupUrl() {
    const {search} = window.location;
    // honor any existing query params
    const separator = search.includes('?') ? '&' : '?';
    return `${search}${separator}manual=1`;
  }

  fetchData = async () => {
    const {api, organization, integrationSlug} = this.props;

    if (!integrationSlug) {
      return;
    }

    try {
      const endpoint = `/organizations/${organization.slug}/config/integrations/?provider_key=${integrationSlug}`;
      const integrations = await api.requestPromise(endpoint);
      const provider = integrations.providers[0];

      this.setState({provider});
    } catch (error) {
      this.setState({error});
    }
    this.setState({loading: false});
  };

  redirectToNeutralDocs() {
    const {orgId, projectId} = this.props.params;

    const url = `/organizations/${orgId}/projects/${projectId}/getting-started/`;

    browserHistory.push(url);
  }

  handleAddIntegration = () => {
    this.setState({installed: true});
  };

  render() {
    const {organization, params} = this.props;
    const {provider, installed} = this.state;
    const {projectId, orgId, platform} = params;

    const platformIntegration = platforms.find(p => p.id === platform);
    if (!provider || !platformIntegration) {
      return null;
    }
    const gettingStartedLink = `/organizations/${orgId}/projects/${projectId}/getting-started/`;

    //TODO: make dynamic when adding more integrations
    const docsLink = 'https://docs.sentry.io/product/integrations/aws-lambda/';

    return (
      <React.Fragment>
        <PlatformHeader
          title={t('Automatically instrument %s', platformIntegration.name)}
          gettingStartedLink={gettingStartedLink}
          docsLink={docsLink}
        />
        {!installed ? (
          <React.Fragment>
            <StyledAlert type="info">
              {tct(
                'Want to manually install the SDK instead? [link:See SDK instruction docs].',
                {
                  link: <Button priority="link" href={this.manualSetupUrl} />,
                }
              )}
            </StyledAlert>
            <Instructions>
              {t(
                'Instrument Sentry without any code changes! Just press the "Add Integration" button below and complete the steps in the popup that opens.'
              )}
            </Instructions>
            <div>
              <AddIntegrationButton
                provider={provider}
                onAddIntegration={this.handleAddIntegration}
                organization={organization}
                priority="primary"
                size="small"
                analyticsParams={{view: 'project_creation', already_installed: false}}
                modalParams={{projectId}}
              />
            </div>
          </React.Fragment>
        ) : (
          <PlatformFooter
            projectSlug={projectId}
            orgSlug={orgId}
            platform={platformIntegration}
          />
        )}
      </React.Fragment>
    );
  }
}

const Instructions = styled('div')`
  margin: 10px;
`;

const StyledAlert = styled(Alert)`
  margin-top: ${space(2)};
`;

export default withApi(withOrganization(PlatformIntegrationSetup));

import 'prism-sentry/index.css';

import React from 'react';
import {browserHistory, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import platforms from 'app/data/platforms';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {IntegrationProvider, Organization, Project} from 'app/types';
import {trackIntegrationEvent} from 'app/utils/integrationUtil';
import withOrganization from 'app/utils/withOrganization';
import FirstEventFooter from 'app/views/onboarding/components/firstEventFooter';
import PostInstallCodeSnippet from 'app/views/onboarding/components/postInstallCodeSnippet';
import AddIntegrationButton from 'app/views/organizationIntegrations/addIntegrationButton';

import PlatformHeader from './components/platformHeader';

type Props = {
  organization: Organization;
  integrationSlug: string;
} & WithRouterProps<{orgId: string; projectId: string; platform: string}, {}> &
  AsyncComponent['props'];

type State = {
  installed: boolean;
  integrations: {providers: IntegrationProvider[]};
  project: Project | null;
} & AsyncComponent['state'];

class PlatformIntegrationSetup extends AsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      installed: false,
      integrations: {providers: []},
      project: null,
    };
  }

  componentDidMount() {
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

  get provider() {
    const {providers} = this.state.integrations;
    return providers.length ? providers[0] : null;
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, integrationSlug, params} = this.props;

    if (!integrationSlug) {
      return [];
    }

    return [
      [
        'integrations',
        `/organizations/${organization.slug}/config/integrations/?provider_key=${integrationSlug}`,
      ],
      ['project', `/projects/${organization.slug}/${params.projectId}/`],
    ];
  }

  redirectToNeutralDocs() {
    const {orgId, projectId} = this.props.params;

    const url = `/organizations/${orgId}/projects/${projectId}/getting-started/`;

    browserHistory.push(url);
  }

  handleAddIntegration = () => {
    this.setState({installed: true});
  };

  trackSwitchToManual = () => {
    const {organization, integrationSlug} = this.props;
    trackIntegrationEvent(
      {
        eventKey: 'integrations.switch_manual_sdk_setup',
        eventName: 'Integrations: Switch Manual SDK Setup',
        integration_type: 'first_party',
        integration: integrationSlug,
        view: 'project_creation',
      },
      organization
    );
  };

  render() {
    const {organization, params} = this.props;
    const {installed, project} = this.state;
    const {projectId, orgId, platform} = params;
    const provider = this.provider;

    const platformIntegration = platforms.find(p => p.id === platform);
    if (!provider || !platformIntegration || !project) {
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
            <Instructions>
              {t(
                'Instrument Sentry without any code changes! Just press the "Add Integration" button below and complete the steps in the popup that opens.'
              )}
            </Instructions>
            <StyledButtonBar gap={1}>
              <AddIntegrationButton
                provider={provider}
                onAddIntegration={this.handleAddIntegration}
                organization={organization}
                priority="primary"
                size="small"
                analyticsParams={{view: 'project_creation', already_installed: false}}
                modalParams={{projectId}}
                buttonText={t('Add Integration')}
              />
              <Button
                size="small"
                to={{
                  pathname: window.location.pathname,
                  query: {manual: '1'},
                }}
                onClick={this.trackSwitchToManual}
              >
                {t('Manual Setup')}
              </Button>
            </StyledButtonBar>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <PostInstallCodeSnippet provider={provider} />
            <FirstEventFooter
              project={project}
              organization={organization}
              docsLink={docsLink}
            />
          </React.Fragment>
        )}
      </React.Fragment>
    );
  }
}

const Instructions = styled('div')`
  margin-top: ${space(3)};
`;

const StyledButtonBar = styled(ButtonBar)`
  margin-top: ${space(3)};
  width: max-content;

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    width: auto;
    grid-row-gap: ${space(1)};
    grid-auto-flow: row;
  }
`;

export default withOrganization(PlatformIntegrationSetup);

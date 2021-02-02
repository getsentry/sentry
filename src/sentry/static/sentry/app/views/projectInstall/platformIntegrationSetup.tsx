import 'prism-sentry/index.css';

import React from 'react';
import {browserHistory, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import ExternalLink from 'app/components/links/externalLink';
import platforms from 'app/data/platforms';
import {t, tct} from 'app/locale';
import {PageHeader} from 'app/styles/organization';
import space from 'app/styles/space';
import {IntegrationProvider, Organization, Project} from 'app/types';
import {trackIntegrationEvent} from 'app/utils/integrationUtil';
import withOrganization from 'app/utils/withOrganization';
import FirstEventFooter from 'app/views/onboarding/components/firstEventFooter';
import PostInstallCodeSnippet from 'app/views/onboarding/components/postInstallCodeSnippet';
import AddIntegrationButton from 'app/views/organizationIntegrations/addIntegrationButton';

import PlatformHeaderButtonBar from './components/platformHeaderButtonBar';

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
      <OuterWrapper>
        <StyledPageHeader>
          <StyledTitle>
            {t('Automatically instrument %s', platformIntegration.name)}
          </StyledTitle>
          <PlatformHeaderButtonBar
            gettingStartedLink={gettingStartedLink}
            docsLink={docsLink}
          />
        </StyledPageHeader>
        <InnerWrapper>
          {!installed ? (
            <React.Fragment>
              <p>
                {tct(
                  'The automated AWS Lambda setup will instrument your Lambda functions with Sentry error and performance monitoring without any code changes. We use CloudFormation Stack ([learnMore]) to create Sentry role which gives us access to your AWS account.',
                  {
                    learnMore: (
                      <ExternalLink>{t('Learn more about CloudFormation')}</ExternalLink>
                    ),
                  }
                )}
              </p>
              <p>
                {tct(
                  'Just press the [addInstallation] button below and complete the steps in the popup that opens.',
                  {addInstallation: <strong>{t('Add Installation')}</strong>}
                )}
              </p>
              <p>
                {tct(
                  'If you don’t want to add CloudFormation stack to your AWS environment, press the [manualSetup] button instead.',
                  {manualSetup: <strong>{t('Manual Setup')}</strong>}
                )}
              </p>
              <StyledButtonBar gap={1}>
                <AddIntegrationButton
                  provider={provider}
                  onAddIntegration={this.handleAddIntegration}
                  organization={organization}
                  priority="primary"
                  size="small"
                  analyticsParams={{view: 'project_creation', already_installed: false}}
                  modalParams={{projectId: project.id}}
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
        </InnerWrapper>
      </OuterWrapper>
    );
  }
}

const StyledButtonBar = styled(ButtonBar)`
  margin-top: ${space(3)};
  width: max-content;

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    width: auto;
    grid-row-gap: ${space(1)};
    grid-auto-flow: row;
  }
`;

const InnerWrapper = styled('div')`
  width: 850px;
`;

const OuterWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const StyledPageHeader = styled(PageHeader)`
  margin-bottom: ${space(3)};
`;

const StyledTitle = styled('h2')`
  margin: 0 ${space(3)} 0 0;
`;

export default withOrganization(PlatformIntegrationSetup);

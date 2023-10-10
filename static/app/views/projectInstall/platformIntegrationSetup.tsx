import {Fragment} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import platforms from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {IntegrationProvider, Organization, Project} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import withOrganization from 'sentry/utils/withOrganization';
import AddInstallationInstructions from 'sentry/views/onboarding/components/integrations/addInstallationInstructions';
import PostInstallCodeSnippet from 'sentry/views/onboarding/components/integrations/postInstallCodeSnippet';
import {AddIntegrationButton} from 'sentry/views/settings/organizationIntegrations/addIntegrationButton';

import FirstEventFooter from './components/firstEventFooter';
import PlatformHeaderButtonBar from './components/platformHeaderButtonBar';

type Props = {
  integrationSlug: string;
  organization: Organization;
} & RouteComponentProps<{platform: string; projectId: string}, {}> &
  DeprecatedAsyncComponent['props'];

type State = {
  installed: boolean;
  integrations: {providers: IntegrationProvider[]};
  project: Project | null;
} & DeprecatedAsyncComponent['state'];

class PlatformIntegrationSetup extends DeprecatedAsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      installed: false,
      integrations: {providers: []},
      project: null,
    };
  }

  componentDidMount() {
    super.componentDidMount();
    window.scrollTo(0, 0);

    const {platform} = this.props.params;

    // redirect if platform is not known.
    if (!platform || platform === 'other') {
      this.redirectToNeutralDocs();
    }
  }

  get provider() {
    const {providers} = this.state.integrations;
    return providers.length ? providers[0] : null;
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
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

  handleFullDocsClick = () => {
    const {organization} = this.props;
    trackAnalytics('growth.onboarding_view_full_docs', {organization});
  };

  redirectToNeutralDocs() {
    const {organization} = this.props;
    const {projectId} = this.props.params;

    const url = `/organizations/${organization.slug}/projects/${projectId}/getting-started/`;

    browserHistory.push(normalizeUrl(url));
  }

  handleAddIntegration = () => {
    this.setState({installed: true});
  };

  trackSwitchToManual = () => {
    const {organization, integrationSlug} = this.props;
    trackIntegrationAnalytics('integrations.switch_manual_sdk_setup', {
      integration_type: 'first_party',
      integration: integrationSlug,
      view: 'project_creation',
      organization,
    });
  };

  render() {
    const {organization, params} = this.props;
    const {installed, project} = this.state;
    const {projectId, platform} = params;
    const provider = this.provider;

    const platformIntegration = platforms.find(p => p.id === platform);
    if (!provider || !platformIntegration || !project) {
      return null;
    }
    const gettingStartedLink = `/organizations/${organization.slug}/projects/${projectId}/getting-started/`;

    // TODO: make dynamic when adding more integrations
    const docsLink =
      'https://docs.sentry.io/product/integrations/cloud-monitoring/aws-lambda/';

    return (
      <OuterWrapper>
        <InnerWrapper>
          <StyledTitle>
            {t('Automatically instrument %s', platformIntegration.name)}
          </StyledTitle>
          <HeaderButtons>
            <PlatformHeaderButtonBar
              gettingStartedLink={gettingStartedLink}
              docsLink={docsLink}
            />
          </HeaderButtons>
          {!installed ? (
            <Fragment>
              <AddInstallationInstructions />
              <StyledButtonBar gap={1}>
                <AddIntegrationButton
                  provider={provider}
                  onAddIntegration={this.handleAddIntegration}
                  organization={organization}
                  priority="primary"
                  size="sm"
                  analyticsParams={{view: 'project_creation', already_installed: false}}
                  modalParams={{projectId: project.id}}
                  aria-label={t('Add integration')}
                />
                <Button
                  size="sm"
                  to={{
                    pathname: window.location.pathname,
                    query: {manual: '1'},
                  }}
                  onClick={this.trackSwitchToManual}
                >
                  {t('Manual Setup')}
                </Button>
              </StyledButtonBar>
            </Fragment>
          ) : (
            <Fragment>
              <PostInstallCodeSnippet provider={provider} />
              <FirstEventFooter
                project={project}
                organization={organization}
                docsLink={docsLink}
                docsOnClick={this.handleFullDocsClick}
              />
            </Fragment>
          )}
        </InnerWrapper>
      </OuterWrapper>
    );
  }
}

const StyledButtonBar = styled(ButtonBar)`
  margin-top: ${space(3)};
  width: max-content;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    width: auto;
    grid-row-gap: ${space(1)};
    grid-auto-flow: row;
  }
`;

const InnerWrapper = styled('div')`
  max-width: 850px;
`;

const OuterWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 50px;
`;

const HeaderButtons = styled('div')`
  width: min-content;
  margin-bottom: ${space(3)};
`;

const StyledTitle = styled('h2')`
  margin: 0;
  margin-bottom: ${space(2)};
`;

export default withOrganization(PlatformIntegrationSetup);

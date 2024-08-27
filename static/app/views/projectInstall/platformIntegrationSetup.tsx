import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {IntegrationProvider} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {PlatformIntegration, Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import withOrganization from 'sentry/utils/withOrganization';
import AddInstallationInstructions from 'sentry/views/onboarding/components/integrations/addInstallationInstructions';
import PostInstallCodeSnippet from 'sentry/views/onboarding/components/integrations/postInstallCodeSnippet';
import {PlatformDocHeader} from 'sentry/views/projectInstall/platformDocHeader';
import {AddIntegrationButton} from 'sentry/views/settings/organizationIntegrations/addIntegrationButton';

import FirstEventFooter from './components/firstEventFooter';

type Props = {
  integrationSlug: string;
  onClickManualSetup: () => void;
  organization: Organization;
  platform: PlatformIntegration | undefined;
  project: Project | undefined;
} & DeprecatedAsyncComponent['props'];

type State = {
  installed: boolean;
  integrations: {providers: IntegrationProvider[]};
} & DeprecatedAsyncComponent['state'];

class PlatformIntegrationSetup extends DeprecatedAsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      installed: false,
      integrations: {providers: []},
    };
  }

  componentDidMount() {
    super.componentDidMount();
    window.scrollTo(0, 0);

    const {platform} = this.props;

    // redirect if platform is not known.
    if (!platform || platform.id === 'other') {
      this.redirectToNeutralDocs();
    }
  }

  get provider() {
    const {providers} = this.state.integrations;
    return providers.length ? providers[0] : null;
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {organization, integrationSlug} = this.props;

    if (!integrationSlug) {
      return [];
    }

    return [
      [
        'integrations',
        `/organizations/${organization.slug}/config/integrations/?provider_key=${integrationSlug}`,
      ],
    ];
  }

  handleFullDocsClick = () => {
    const {organization} = this.props;
    trackAnalytics('growth.onboarding_view_full_docs', {organization});
  };

  redirectToNeutralDocs() {
    const {organization, project} = this.props;

    if (!project) {
      return;
    }

    const url = `/organizations/${organization.slug}/projects/${project.slug}/getting-started/`;

    browserHistory.push(normalizeUrl(url));
  }

  handleAddIntegration = () => {
    this.setState({installed: true});
  };

  trackSwitchToManual = () => {
    const {onClickManualSetup, organization, integrationSlug} = this.props;
    onClickManualSetup();
    trackIntegrationAnalytics('integrations.switch_manual_sdk_setup', {
      integration_type: 'first_party',
      integration: integrationSlug,
      view: 'project_creation',
      organization,
    });
  };

  render() {
    const {organization, project, platform} = this.props;
    const {installed} = this.state;
    const provider = this.provider;

    if (!provider || !platform || !project) {
      return null;
    }

    // TODO: make dynamic when adding more integrations
    const docsLink =
      'https://docs.sentry.io/product/integrations/cloud-monitoring/aws-lambda/';

    return (
      <OuterWrapper>
        <InnerWrapper>
          <PlatformDocHeader
            platform={{
              key: platform.id,
              id: platform.id,
              name: platform.name,
              link: platform.link,
            }}
            projectSlug={project.slug}
            title={t('Automatically instrument %s', platform.name)}
          />
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
                <Button size="sm" onClick={this.trackSwitchToManual}>
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

export default withOrganization(PlatformIntegrationSetup);

import 'prism-sentry/index.css';

import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {openInviteMembersModal} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import LoadingError from 'app/components/loadingError';
import {PlatformKey} from 'app/data/platformCategories';
import platforms from 'app/data/platforms';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {IntegrationProvider, Organization} from 'app/types';
import {trackAdvancedAnalyticsEvent} from 'app/utils/advancedAnalytics';
import getDynamicText from 'app/utils/getDynamicText';
import {trackIntegrationEvent} from 'app/utils/integrationUtil';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import AddIntegrationButton from 'app/views/organizationIntegrations/addIntegrationButton';

import FirstEventFooter from './components/firstEventFooter';
import AddInstallationInstructions from './components/integrations/addInstallationInstructions';
import PostInstallCodeSnippet from './components/integrations/postInstallCodeSnippet';
import SetupIntroduction from './components/setupIntroduction';
import {StepProps} from './types';

type Props = StepProps & {
  api: Client;
  organization: Organization;
  integrationSlug: string;
};

type State = {
  loadedPlatform: PlatformKey | null;
  hasError: boolean;
  provider: IntegrationProvider | null;
  installed: boolean;
};

class IntegrationSetup extends Component<Props, State> {
  state: State = {
    loadedPlatform: null,
    hasError: false,
    provider: null,
    installed: false,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(nextProps: Props) {
    if (
      nextProps.platform !== this.props.platform ||
      nextProps.project !== this.props.project
    ) {
      this.fetchData();
    }
  }

  get manualSetupUrl() {
    const {search} = window.location;
    // honor any existing query params
    const separator = search.includes('?') ? '&' : '?';
    return `${search}${separator}manual=1`;
  }

  get platformDocs() {
    // TODO: make dynamic based on the integration
    return 'https://docs.sentry.io/product/integrations/cloud-monitoring/aws-lambda/';
  }

  fetchData = async () => {
    const {api, organization, platform, integrationSlug} = this.props;

    if (!integrationSlug) {
      return;
    }

    try {
      const endpoint = `/organizations/${organization.slug}/config/integrations/?provider_key=${integrationSlug}`;
      const integrations = await api.requestPromise(endpoint);
      const provider = integrations.providers[0];

      this.setState({provider, loadedPlatform: platform, hasError: false});
    } catch (error) {
      this.setState({hasError: error});
      throw error;
    }
  };

  handleFullDocsClick = () => {
    const {organization} = this.props;
    trackAdvancedAnalyticsEvent('growth.onboarding_view_full_docs', {}, organization);
  };

  trackSwitchToManual = () => {
    const {organization, integrationSlug} = this.props;
    trackIntegrationEvent(
      'integrations.switch_manual_sdk_setup',
      {
        integration_type: 'first_party',
        integration: integrationSlug,
        view: 'onboarding',
      },
      organization
    );
  };

  handleAddIntegration = () => {
    this.setState({installed: true});
  };

  renderSetupInstructions = () => {
    const {platform} = this.props;
    const {loadedPlatform} = this.state;
    const currentPlatform = loadedPlatform ?? platform ?? 'other';
    return (
      <SetupIntroduction
        stepHeaderText={t(
          'Automatically instrument %s',
          platforms.find(p => p.id === currentPlatform)?.name ?? ''
        )}
        platform={currentPlatform}
      />
    );
  };

  renderIntegrationInstructions() {
    const {organization, project} = this.props;
    const {provider} = this.state;
    if (!provider || !project) {
      return null;
    }

    return (
      <Fragment>
        {this.renderSetupInstructions()}
        <motion.p
          variants={{
            initial: {opacity: 0},
            animate: {opacity: 1},
            exit: {opacity: 0},
          }}
        >
          {tct(
            "Don't have have permissions to create a Cloudformation stack? [link:Invite your team instead].",
            {
              link: (
                <Button
                  priority="link"
                  onClick={() => {
                    openInviteMembersModal();
                  }}
                />
              ),
            }
          )}
        </motion.p>
        <motion.div
          variants={{
            initial: {opacity: 0},
            animate: {opacity: 1},
            exit: {opacity: 0},
          }}
        >
          <AddInstallationInstructions />
        </motion.div>

        <DocsWrapper>
          <StyledButtonBar gap={1}>
            <AddIntegrationButton
              provider={provider}
              onAddIntegration={this.handleAddIntegration}
              organization={organization}
              priority="primary"
              size="small"
              analyticsParams={{view: 'onboarding', already_installed: false}}
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
        </DocsWrapper>
      </Fragment>
    );
  }

  renderPostInstallInstructions() {
    const {organization, project, platform} = this.props;
    const {provider} = this.state;
    if (!project || !provider || !platform) {
      return null;
    }
    return (
      <Fragment>
        {this.renderSetupInstructions()}
        <PostInstallCodeSnippet provider={provider} platform={platform} isOnboarding />
        <FirstEventFooter
          project={project}
          organization={organization}
          docsLink={this.platformDocs}
          docsOnClick={this.handleFullDocsClick}
        />
      </Fragment>
    );
  }

  render() {
    const {platform} = this.props;
    const {hasError} = this.state;

    const loadingError = (
      <LoadingError
        message={t('Failed to load the integration for the %s platform.', platform)}
        onRetry={this.fetchData}
      />
    );

    const testOnlyAlert = (
      <Alert type="warning">
        Platform documentation is not rendered in for tests in CI
      </Alert>
    );

    return (
      <Fragment>
        {this.state.installed
          ? this.renderPostInstallInstructions()
          : this.renderIntegrationInstructions()}
        {getDynamicText({
          value: !hasError ? null : loadingError,
          fixed: testOnlyAlert,
        })}
      </Fragment>
    );
  }
}

const DocsWrapper = styled(motion.div)``;

DocsWrapper.defaultProps = {
  initial: {opacity: 0, y: 40},
  animate: {opacity: 1, y: 0},
  exit: {opacity: 0},
};

const StyledButtonBar = styled(ButtonBar)`
  margin-top: ${space(3)};
  width: max-content;

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    width: auto;
    grid-row-gap: ${space(1)};
    grid-auto-flow: row;
  }
`;

export default withOrganization(withApi(IntegrationSetup));

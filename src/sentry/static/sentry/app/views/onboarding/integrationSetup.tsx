import 'prism-sentry/index.css';

import React from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {openInviteMembersModal} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import LoadingError from 'app/components/loadingError';
import {PlatformKey} from 'app/data/platformCategories';
import platforms from 'app/data/platforms';
import {t, tct} from 'app/locale';
import {IntegrationProvider, Organization, Project} from 'app/types';
import {analytics} from 'app/utils/analytics';
import getDynamicText from 'app/utils/getDynamicText';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import AddIntegrationButton from 'app/views/organizationIntegrations/addIntegrationButton';

import FirstEventFooter from './components/firstEventFooter';
import SetupIntroduction from './components/setupIntroduction';
import {StepProps} from './types';

type AnalyticsOpts = {
  organization: Organization;
  project: Project | null;
  platform: PlatformKey | null;
};

const recordAnalyticsDocsClicked = ({organization, project, platform}: AnalyticsOpts) =>
  analytics('onboarding_v2.full_docs_clicked', {
    org_id: organization.id,
    project: project?.slug,
    platform,
  });

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

class IntegrationSetup extends React.Component<Props, State> {
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
    return 'https://docs.sentry.io/product/integrations/aws-lambda/';
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
    const {organization, project, platform} = this.props;
    recordAnalyticsDocsClicked({organization, project, platform});
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
    const {organization} = this.props;
    const {provider} = this.state;
    if (!provider) {
      return null;
    }

    return (
      <React.Fragment>
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
              link: <Button priority="link" onClick={openInviteMembersModal} />,
            }
          )}
        </motion.p>
        <motion.p
          variants={{
            initial: {opacity: 0},
            animate: {opacity: 1},
            exit: {opacity: 0},
          }}
        >
          {tct(
            'Want to manually install the SDK instead? [link:See SDK instruction docs].',
            {
              link: <Button priority="link" href={this.manualSetupUrl} />,
            }
          )}
        </motion.p>
        <motion.p
          variants={{
            initial: {opacity: 0},
            animate: {opacity: 1},
            exit: {opacity: 0},
          }}
        >
          {t(
            'Instrument Sentry without any code changes! Just press the "Add Integration" button below and complete the steps in the popup that opens.'
          )}
        </motion.p>

        <DocsWrapper>
          <AddIntegrationButton
            provider={provider}
            onAddIntegration={this.handleAddIntegration}
            organization={organization}
            priority="primary"
            size="small"
          />
        </DocsWrapper>
      </React.Fragment>
    );
  }

  renderPostInstallText() {
    const {provider} = this.state;
    if (!provider) {
      return null;
    }
    //TODO: dyanically determine the snippet based on the language
    return (
      <div>
        <p>
          {t(
            "Congrats, you just installed the %s integration! Now that it's is installed, the next time you trigger an error it will go to your Sentry.",
            provider.name
          )}
        </p>
        <p>
          {t(
            'This snippet includes an intentional error, so you can test that everything is working as soon as you set it up:'
          )}
        </p>
        <div>
          <CodeWrapper>
            <code>
              <TokenFunction>myUndefinedFunction</TokenFunction>
              <TokenPunctuation>();</TokenPunctuation>
            </code>
          </CodeWrapper>
        </div>
        <p>
          {t(
            "If you're new to Sentry, use the email alert to access your account and complete a product tour."
          )}
        </p>
        <p>
          {t(
            "If you're an existing user and have disabled alerts, you won't receive this email."
          )}
        </p>
      </div>
    );
  }

  renderPostInstallInstructions() {
    const {organization, project} = this.props;
    const {provider} = this.state;
    if (!project || !provider) {
      return null;
    }
    return (
      <React.Fragment>
        {this.renderSetupInstructions()}
        {this.renderPostInstallText()}
        <FirstEventFooter
          project={project}
          organization={organization}
          docsLink={this.platformDocs}
          docsOnClick={this.handleFullDocsClick}
        />
      </React.Fragment>
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
      <React.Fragment>
        {this.state.installed
          ? this.renderPostInstallInstructions()
          : this.renderIntegrationInstructions()}
        {getDynamicText({
          value: !hasError ? null : loadingError,
          fixed: testOnlyAlert,
        })}
      </React.Fragment>
    );
  }
}
const CodeWrapper = styled('pre')`
  padding: 1em;
  overflow: auto;
  background: #251f3d;
  font-size: 15px;
`;

const TokenFunction = styled('span')`
  color: #7cc5c4;
`;

const TokenPunctuation = styled('span')`
  color: #b3acc1;
`;

const DocsWrapper = styled(motion.div)``;

DocsWrapper.defaultProps = {
  initial: {opacity: 0, y: 40},
  animate: {opacity: 1, y: 0},
  exit: {opacity: 0},
};

export default withOrganization(withApi(IntegrationSetup));

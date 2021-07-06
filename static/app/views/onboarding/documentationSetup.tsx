import 'prism-sentry/index.css';

import * as React from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {loadDocs} from 'app/actionCreators/projects';
import {Client} from 'app/api';
import Alert, {alertStyles} from 'app/components/alert';
import ExternalLink from 'app/components/links/externalLink';
import LoadingError from 'app/components/loadingError';
import {PlatformKey} from 'app/data/platformCategories';
import platforms from 'app/data/platforms';
import {IconInfo} from 'app/icons';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {trackAdvancedAnalyticsEvent} from 'app/utils/advancedAnalytics';
import getDynamicText from 'app/utils/getDynamicText';
import {Theme} from 'app/utils/theme';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

import FirstEventFooter from './components/firstEventFooter';
import FullIntroduction from './components/fullIntroduction';
import {StepProps} from './types';

/**
 * The documentation will include the following string should it be missing the
 * verification example, which currently a lot of docs are.
 */
const INCOMPLETE_DOC_FLAG = 'TODO-ADD-VERIFICATION-EXAMPLE';

type Props = StepProps & {
  api: Client;
  organization: Organization;
};

type State = {
  platformDocs: {html: string; link: string} | null;
  loadedPlatform: PlatformKey | null;
  hasError: boolean;
};

class DocumentationSetup extends React.Component<Props, State> {
  state: State = {
    platformDocs: null,
    loadedPlatform: null,
    hasError: false,
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

  fetchData = async () => {
    const {api, project, organization, platform} = this.props;

    if (!project || !platform) {
      return;
    }

    try {
      const platformDocs = await loadDocs(api, organization.slug, project.slug, platform);
      this.setState({platformDocs, loadedPlatform: platform, hasError: false});
    } catch (error) {
      this.setState({hasError: error});
      throw error;
    }
  };

  handleFullDocsClick = () => {
    const {organization} = this.props;
    trackAdvancedAnalyticsEvent('growth.onboarding_view_full_docs', {}, organization);
  };

  /**
   * TODO(epurkhiser): This can be removed once all documentation has an
   * example for sending the users first event.
   */
  get missingExampleWarning() {
    const {loadedPlatform, platformDocs} = this.state;
    const missingExample =
      platformDocs && platformDocs.html.includes(INCOMPLETE_DOC_FLAG);

    if (!missingExample) {
      return null;
    }

    return (
      <Alert type="warning" icon={<IconInfo size="md" />}>
        {tct(
          `Looks like this getting started example is still undergoing some
           work and doesn't include an example for triggering an event quite
           yet. If you have trouble sending your first event be sure to consult
           the [docsLink:full documentation] for [platform].`,
          {
            docsLink: <ExternalLink href={platformDocs?.link} />,
            platform: platforms.find(p => p.id === loadedPlatform)?.name,
          }
        )}
      </Alert>
    );
  }

  render() {
    const {organization, project, platform} = this.props;
    const {loadedPlatform, platformDocs, hasError} = this.state;

    const currentPlatform = loadedPlatform ?? platform ?? 'other';

    const docs = platformDocs !== null && (
      <DocsWrapper key={platformDocs.html}>
        <Content dangerouslySetInnerHTML={{__html: platformDocs.html}} />
        {this.missingExampleWarning}

        {project && (
          <FirstEventFooter
            project={project}
            organization={organization}
            docsLink={platformDocs?.link}
            docsOnClick={this.handleFullDocsClick}
          />
        )}
      </DocsWrapper>
    );

    const loadingError = (
      <LoadingError
        message={t('Failed to load documentation for the %s platform.', platform)}
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
        <FullIntroduction currentPlatform={currentPlatform} />
        {getDynamicText({
          value: !hasError ? docs : loadingError,
          fixed: testOnlyAlert,
        })}
      </React.Fragment>
    );
  }
}

type AlertType = React.ComponentProps<typeof Alert>['type'];

const getAlertSelector = (type: AlertType) =>
  type === 'muted' ? null : `.alert[level="${type}"], .alert-${type}`;

const mapAlertStyles = (p: {theme: Theme}, type: AlertType) =>
  css`
    ${getAlertSelector(type)} {
      ${alertStyles({theme: p.theme, type})};
      display: block;
    }
  `;

const Content = styled(motion.div)`
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  p {
    margin-bottom: 18px;
  }

  div[data-language] {
    margin-bottom: ${space(2)};
  }

  code {
    font-size: 87.5%;
    color: ${p => p.theme.pink300};
  }

  pre code {
    color: inherit;
    font-size: inherit;
    white-space: pre;
  }

  h2 {
    font-size: 1.4em;
  }

  .alert h5 {
    font-size: 1em;
    margin-bottom: 1rem;
  }

  /**
   * XXX(epurkhiser): This comes from the doc styles and avoids bottom margin issues in alerts
   */
  .content-flush-bottom *:last-child {
    margin-bottom: 0;
  }

  ${p => Object.keys(p.theme.alert).map(type => mapAlertStyles(p, type as AlertType))}
`;

const DocsWrapper = styled(motion.div)``;

DocsWrapper.defaultProps = {
  initial: {opacity: 0, y: 40},
  animate: {opacity: 1, y: 0},
  exit: {opacity: 0},
};

export default withOrganization(withApi(DocumentationSetup));

import styled from '@emotion/styled';
import {css} from '@emotion/core';
import PropTypes from 'prop-types';
import * as React from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import PlatformIcon from 'platformicons';

import {analytics} from 'app/utils/analytics';
import {loadDocs} from 'app/actionCreators/projects';
import {t, tct} from 'app/locale';
import Alert, {alertStyles} from 'app/components/alert';
import Button from 'app/components/button';
import ExternalLink from 'app/components/links/externalLink';
import FirstEventIndicator from 'app/views/onboarding/projectSetup/firstEventIndicator';
import {IconInfo} from 'app/icons';
import LoadingError from 'app/components/loadingError';
import Panel from 'app/components/panels/panel';
import PanelBody from 'app/components/panels/panelBody';
import platforms from 'app/data/platforms';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';
import getDynamicText from 'app/utils/getDynamicText';
import withOrganization from 'app/utils/withOrganization';
import testableTransition from 'app/utils/testableTransition';
import {Organization, Project} from 'app/types';
import {PlatformKey} from 'app/data/platformCategories';
import {Client} from 'app/api';
import {Theme} from 'app/utils/theme';

import {StepProps} from '../types';

/**
 * The documentation will include the following string should it be missing the
 * verification example, which currently a lot of docs are.
 */
const INCOMPLETE_DOC_FLAG = 'TODO-ADD-VERIFICATION-EXAMPLE';

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
};

type State = {
  platformDocs: {html: string; link: string} | null;
  loadedPlatform: PlatformKey | null;
  hasError: boolean;
};

class ProjectDocs extends React.Component<Props, State> {
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
      if (platform === 'other') {
        // TODO(epurkhiser): There are currently no docs for the other
        // platform. We should add generic documentation, in which case, this
        // check should go away.
        return;
      }

      this.setState({hasError: error});
      throw error;
    }
  };

  handleFullDocsClick = () => {
    const {organization, project, platform} = this.props;
    recordAnalyticsDocsClicked({organization, project, platform});
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
           yet! If you have trouble sending your first event be sure to consult
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
    const {organization, project, platform, scrollTargetId} = this.props;
    const {loadedPlatform, platformDocs, hasError} = this.state;

    const introduction = (
      <Panel>
        <PanelBody withPadding>
          <PlatformHeading platform={loadedPlatform ?? platform ?? 'other'} />

          <Description id={scrollTargetId}>
            {tct(
              `Follow these instructions to install and verify the integration
               of Sentry into your application, including sending
               [strong:your first event] from your development environment. See
               the full documentation for additional configuration, platform
               features, and methods of sending events.`,
              {strong: <strong />}
            )}
          </Description>
          <Footer>
            {project && (
              <FirstEventIndicator
                organization={organization}
                project={project}
                eventType="error"
              />
            )}
            <div>
              <Button
                external
                onClick={this.handleFullDocsClick}
                href={platformDocs?.link}
                size="small"
              >
                {t('Full Documentation')}
              </Button>
            </div>
          </Footer>
        </PanelBody>
      </Panel>
    );

    const docs = platformDocs !== null && (
      <DocsContainer>
        <AnimatePresence>
          <DocsWrapper key={platformDocs.html}>
            <div dangerouslySetInnerHTML={{__html: platformDocs.html}} />
            {this.missingExampleWarning}
          </DocsWrapper>
        </AnimatePresence>
      </DocsContainer>
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
        {introduction}
        {getDynamicText({
          value: !hasError ? docs : loadingError,
          fixed: testOnlyAlert,
        })}
      </React.Fragment>
    );
  }
}

const docsTransition = {
  initial: {
    opacity: 0,
    y: -10,
  },
  animate: {
    opacity: 1,
    y: 0,
    delay: 0.1,
    transition: {duration: 0.2},
  },
  exit: {
    opacity: 0,
    y: 10,
    transition: {duration: 0.2},
  },
  transition: testableTransition(),
};

const Description = styled('p')`
  font-size: 0.9em;
`;

const Footer = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
  grid-template-columns: 1fr max-content;
  align-items: center;
`;

const HeadingContainer = styled('div')`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
`;

const Heading = styled(motion.div)`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(1)};
  align-items: center;
  margin-bottom: ${space(2)};
  grid-column: 1;
  grid-row: 1;
`;

Heading.defaultProps = {
  ...docsTransition,
};

const Header = styled('div')`
  font-size: 1.8rem;
  margin-right: 16px;
  font-weight: bold;
`;

const PlatformHeading = ({platform}) => (
  <HeadingContainer>
    <AnimatePresence initial={false}>
      <Heading key={platform}>
        <PlatformIcon platform={platform} size={24} />
        <Header>
          {t(
            '%s SDK Installation Guide',
            platforms.find(p => p.id === platform)?.name ?? t('Unknown')
          )}
        </Header>
      </Heading>
    </AnimatePresence>
  </HeadingContainer>
);

PlatformHeading.propTypes = {
  platform: PropTypes.string.isRequired,
};

type AlertType = React.ComponentProps<typeof Alert>['type'];

const getAlertClass = (type: AlertType) => (type === 'muted' ? 'alert' : `alert-${type}`);

const mapAlertStyles = (p: {theme: Theme}, type: AlertType) =>
  css`
    .${getAlertClass(type)} {
      ${alertStyles({theme: p.theme, type})};
      display: block;
    }
  `;

const DocsContainer = styled('div')`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
`;

const DocsWrapper = styled(motion.div)`
  grid-column: 1;
  grid-row: 1;

  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  p {
    margin-bottom: 18px;
  }

  code {
    font-size: 87.5%;
    color: #e83e8c;
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

DocsWrapper.defaultProps = {
  ...docsTransition,
};

export default withOrganization(withApi(ProjectDocs));

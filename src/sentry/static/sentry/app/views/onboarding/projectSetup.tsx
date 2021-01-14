import 'prism-sentry/index.css';

import React from 'react';
import {css} from '@emotion/core';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';
import {PlatformIcon} from 'platformicons';

import {openInviteMembersModal} from 'app/actionCreators/modal';
import {loadDocs} from 'app/actionCreators/projects';
import {Client} from 'app/api';
import Alert, {alertStyles} from 'app/components/alert';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import ExternalLink from 'app/components/links/externalLink';
import LoadingError from 'app/components/loadingError';
import {PlatformKey} from 'app/data/platformCategories';
import platforms from 'app/data/platforms';
import {IconInfo} from 'app/icons';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {analytics} from 'app/utils/analytics';
import getDynamicText from 'app/utils/getDynamicText';
import {Theme} from 'app/utils/theme';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import CreateSampleEventButton from 'app/views/onboarding/createSampleEventButton';

import FirstEventIndicator from './components/firstEventIndicator';
import StepHeading from './components/stepHeading';
import {StepProps} from './types';

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

    const introduction = (
      <React.Fragment>
        <TitleContainer>
          <StepHeading step={2}>
            {t(
              'Prepare the %s SDK',
              platforms.find(p => p.id === currentPlatform)?.name ?? ''
            )}
          </StepHeading>
          <motion.div
            variants={{
              initial: {opacity: 0, x: 20},
              animate: {opacity: 1, x: 0},
              exit: {opacity: 0},
            }}
          >
            <PlatformIcon size={48} format="lg" platform={currentPlatform} />
          </motion.div>
        </TitleContainer>
        <motion.p
          variants={{
            initial: {opacity: 0},
            animate: {opacity: 1},
            exit: {opacity: 0},
          }}
        >
          {tct(
            "Don't have a relationship with your terminal? [link:Invite your team instead].",
            {
              link: (
                <Button
                  priority="link"
                  data-test-id="onboarding-getting-started-invite-members"
                  onClick={openInviteMembersModal}
                />
              ),
            }
          )}
        </motion.p>
      </React.Fragment>
    );

    const docs = platformDocs !== null && (
      <DocsWrapper key={platformDocs.html}>
        <Content dangerouslySetInnerHTML={{__html: platformDocs.html}} />
        {this.missingExampleWarning}

        {project && (
          <FirstEventIndicator
            organization={organization}
            project={project}
            eventType="error"
          >
            {({indicator, firstEventButton}) => (
              <CTAFooter>
                <Actions gap={2}>
                  {firstEventButton}
                  <Button
                    external
                    onClick={this.handleFullDocsClick}
                    href={platformDocs?.link}
                  >
                    {t('View full documentation')}
                  </Button>
                </Actions>
                {indicator}
              </CTAFooter>
            )}
          </FirstEventIndicator>
        )}
        <CTASecondary>
          {tct(
            'Just want to poke around before getting too cozy with the SDK? [sample:View a sample event for this SDK] and finish setup later.',
            {
              sample: (
                <CreateSampleEventButton
                  project={project ?? undefined}
                  source="onboarding"
                  priority="link"
                />
              ),
            }
          )}
        </CTASecondary>
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
        {introduction}
        {getDynamicText({
          value: !hasError ? docs : loadingError,
          fixed: testOnlyAlert,
        })}
      </React.Fragment>
    );
  }
}

const TitleContainer = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(2)};
  align-items: center;
  justify-items: end;

  ${StepHeading} {
    margin-bottom: 0;
  }
`;

const CTAFooter = styled('div')`
  display: flex;
  justify-content: space-between;
  margin: ${space(2)} 0;
  margin-top: ${space(4)};
`;

const CTASecondary = styled('p')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;
  max-width: 500px;
`;

const Actions = styled(ButtonBar)`
  display: inline-grid;
  justify-self: start;
`;

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

export default withOrganization(withApi(ProjectDocs));

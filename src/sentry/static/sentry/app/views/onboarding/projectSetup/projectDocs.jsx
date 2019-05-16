import PropTypes from 'prop-types';
import React from 'react';
import posed, {PoseGroup} from 'react-pose';
import styled from 'react-emotion';

import {analytics} from 'app/utils/analytics';
import {loadDocs} from 'app/actionCreators/projects';
import {t, tct} from 'app/locale';
import Button from 'app/components/button';
import FirstEventIndicator from 'app/views/onboarding/projectSetup/firstEventIndicator';
import Panel from 'app/components/panels/panel';
import PanelBody from 'app/components/panels/panelBody';
import PlatformIcon from 'app/components/platformIcon';
import SentryTypes from 'app/sentryTypes';
import platforms from 'app/data/platforms';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

const recordAnalyticsDocsClicked = ({organization, project, platform}) =>
  analytics('onboarding_v2.full_docs_clicked', {
    org_id: parseInt(organization.id, 10),
    project_id: parseInt(organization.id, 10),
    platform,
  });

class ProjectDocs extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
    platform: PropTypes.string,
    scrollTargetId: PropTypes.string,
  };

  state = {
    platformDocs: null,
    loadedPlatform: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(nextProps) {
    if (
      nextProps.platform !== this.props.platform ||
      nextProps.project !== this.props.project
    ) {
      this.fetchData();
    }
  }

  async fetchData() {
    const {api, project, organization, platform} = this.props;

    if (!project) {
      return;
    }

    const platformDocs = await loadDocs(api, organization.slug, project.slug, platform);
    this.setState({platformDocs, loadedPlatform: platform});
  }

  handleFullDocsClick = e => {
    const {organization, project, platform} = this.props;
    recordAnalyticsDocsClicked({organization, project, platform});
  };

  render() {
    const {organization, project, platform, scrollTargetId} = this.props;
    const {loadedPlatform, platformDocs} = this.state;

    const introduction = (
      <Panel>
        <PanelBody disablePadding={false}>
          <AnimatedPlatformHeading platform={loadedPlatform || platform} />

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
              <FirstEventIndicator organization={organization} project={project} />
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
      <PoseGroup preEnterPose="init" animateOnMount>
        <DocsWrapper
          key={platformDocs.html}
          dangerouslySetInnerHTML={{__html: platformDocs.html}}
        />
      </PoseGroup>
    );

    return (
      <React.Fragment>
        {introduction}
        {docs}
      </React.Fragment>
    );
  }
}

const docsTransition = {
  init: {
    opacity: 0,
    y: -10,
  },
  enter: {
    opacity: 1,
    y: 0,
    delay: 100,
    transition: {duration: 200},
  },
  exit: {
    opacity: 0,
    y: 10,
    transition: {duration: 200},
  },
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

const Heading = styled(posed('div')(docsTransition))`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(1)};
  align-items: center;
  margin-bottom: ${space(2)};
`;

const Header = styled('div')`
  font-size: 1.8rem;
  margin-right: 16px;
  font-weight: bold;
`;

const StyledPlatformIcon = styled(PlatformIcon)`
  height: 24px;
  width: 24px;
  border-radius: 3px;
`;

const AnimatedPlatformHeading = ({platform}) => (
  <PoseGroup preEnterPose="init">
    <Heading key={platform}>
      <StyledPlatformIcon platform={platform} />
      <Header>
        {t('%s SDK Installation Guide', platforms.find(p => p.id === platform).name)}
      </Header>
    </Heading>
  </PoseGroup>
);

AnimatedPlatformHeading.propTypes = {
  platform: PropTypes.string.isRequired,
};

const DocsWrapper = styled(posed.div(docsTransition))`
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  p {
    margin-bottom: 18px;
  }

  h2 {
    font-size: 1.4em;
  }
`;

export default withOrganization(withApi(ProjectDocs));

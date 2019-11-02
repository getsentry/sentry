import PropTypes from 'prop-types';
import React from 'react';

import InstallPromptBanner from 'app/views/organizationDetails/installPromptBanner';

import SentryTypes from 'app/sentryTypes';
import Projects from 'app/utils/projects';

class LightWeightInstallPromptBanner extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    teams: PropTypes.arrayOf(SentryTypes.Team),
    loadingTeams: PropTypes.bool,
    error: PropTypes.instanceOf(Error),
  };

  renderChildren = ({projects, fetching}) => {
    if (fetching) {
      return null;
    }
    return <InstallPromptBanner {...this.props} projects={projects} />;
  };

  render() {
    return (
      <Projects orgId={this.props.organization.slug} allProjects>
        {this.renderChildren}
      </Projects>
    );
  }
}

export default LightWeightInstallPromptBanner;

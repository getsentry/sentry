import PropTypes from 'prop-types';
import React from 'react';

import InstallPromptBanner from 'app/views/organizationDetails/installPromptBanner';

import SentryTypes from 'app/sentryTypes';
import withProjects from 'app/utils/withProjects';

class LightWeightInstallPromptBanner extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    projects: PropTypes.arrayOf(SentryTypes.Team),
    loadingProjects: PropTypes.bool,
  };

  render() {
    const {projects, loadingProjects} = this.props;
    if (loadingProjects) {
      return null;
    }
    return <InstallPromptBanner {...this.props} projects={projects} />;
  }
}

export default withProjects(LightWeightInstallPromptBanner);

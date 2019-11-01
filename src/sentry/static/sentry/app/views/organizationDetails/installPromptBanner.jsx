import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {analytics} from 'app/utils/analytics';
import {t} from 'app/locale';
import Alert from 'app/components/alert';
import SentryTypes from 'app/sentryTypes';
import getPlatformName from 'app/utils/getPlatformName';
import withConfig from 'app/utils/withConfig';

class InstallPromptBanner extends React.Component {
  static propTypes = {
    organization: PropTypes.object,
    config: SentryTypes.Config,
    projects: PropTypes.arrayOf(SentryTypes.Project),
  };

  componentDidMount() {
    const {href} = window.location;
    const {organization} = this.props;
    analytics('install_prompt.banner_viewed', {
      org_id: parseInt(organization.id, 10),
      page: href,
    });
  }

  sentFirstEvent() {
    const {config} = this.props;
    // if projects were provided use them, otherwise assume they are in the detailed organization
    const projects = this.props.projects || this.props.organization.projects;
    return !!projects.find(p => p.firstEvent) || !!config.sentFirstEvent;
  }

  get url() {
    const {organization} = this.props;

    // if project with a valid platform then go straight to instructions
    const projects = this.props.projects || organization.projects;
    const projectCount = projects.length;
    if (projectCount > 0 && getPlatformName(projects[projectCount - 1].platform)) {
      return `/onboarding/${organization.slug}/get-started/`;
    }

    // if no projects - redirect back to onboarding flow
    return `/onboarding/${organization.slug}/`;
  }

  recordAnalytics() {
    const {href} = window.location;
    const {organization} = this.props;
    analytics('install_prompt.banner_clicked', {
      org_id: parseInt(organization.id, 10),
      page: href,
    });
  }

  inSetupFlow() {
    const path = window.location.pathname;

    return (
      path.indexOf('/getting-started/') !== -1 ||
      path.indexOf('/onboarding/') !== -1 ||
      path.indexOf('/projects/new/') !== -1 ||
      path.indexOf('/try-business/') !== -1
    );
  }

  render() {
    const sentFirstEvent = this.sentFirstEvent();
    const hideBanner = sentFirstEvent || this.inSetupFlow();

    return (
      <React.Fragment>
        {!hideBanner && (
          <StyledAlert type="warning" icon="icon-circle-exclamation" system="system">
            <a onClick={() => this.recordAnalytics()} href={this.url}>
              {t(
                "You're almost there! Start capturing errors with just a few lines of code."
              )}
            </a>
          </StyledAlert>
        )}
      </React.Fragment>
    );
  }
}

const StyledAlert = styled(Alert)`
  padding: ${p => p.theme.grid}px ${p => p.theme.grid * 2}px;
  position: relative;
  margin: 0;
  padding-right: ${p => p.theme.grid * 4}px;
  a {
    color: #2f2936;
    border-bottom: 1px dotted black;
  }
  use {
    color: black;
  }
`;

export {InstallPromptBanner};
export default withConfig(InstallPromptBanner);

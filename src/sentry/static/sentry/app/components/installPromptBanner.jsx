import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import styled from 'react-emotion';

import {analytics} from 'app/utils/analytics';
import Alert from 'app/components/alert';
import ConfigStore from 'app/stores/configStore';
import {t} from 'app/locale';

const InstallPromptBanner = createReactClass({
  displayName: 'installPromptBanner',
  propTypes: {
    organization: PropTypes.object,
  },

  mixins: [Reflux.listenTo(ConfigStore, 'onConfigStoreUpdate')],

  getInitialState() {
    return {
      sentFirstEvent: false,
    };
  },

  componentDidMount() {
    let {href} = window.location;
    let {organization} = this.props;
    this.sentFirstEvent();
    analytics('install_prompt.banner_viewed', {
      org_id: parseInt(organization.id, 10),
      page: href,
    });
  },

  onConfigStoreUpdate(config) {
    if (!this.state.sentFirstEvent && config.sentFirstEvent) {
      this.setState({sentFirstEvent: true});
    }
  },

  sentFirstEvent() {
    let {onboardingTasks} = this.props.organization;
    let firstEventTask = onboardingTasks.find(task => task.task === 2);
    this.setState({
      sentFirstEvent: firstEventTask && firstEventTask.status === 'complete',
    });
  },

  getUrl() {
    let {organization} = this.props;
    let url;

    // if no projects - redirect back to onboarding flow
    if (organization.projects.length > 0) {
      let project = organization.projects.pop();
      url = `/onboarding/${organization.slug}/${project.slug}/configure/${project.platform}`;
    } else {
      url = `/onboarding/${organization.slug}`;
    }

    return url;
  },

  recordAnalytics() {
    let {href} = window.location;
    let {organization} = this.props;
    analytics('install_prompt.banner_clicked', {
      org_id: parseInt(organization.id, 10),
      page: href,
    });
  },

  inSetupFlow() {
    let path = window.location.pathname;

    return (
      path.indexOf('/getting-started/') !== -1 ||
      path.indexOf('/onboarding/') !== -1 ||
      path.indexOf('/projects/new/') !== -1
    );
  },

  render() {
    let {sentFirstEvent} = this.state;
    let hideBanner = sentFirstEvent || this.inSetupFlow();

    return (
      <React.Fragment>
        {!hideBanner && (
          <StyledAlert type="warning" icon="icon-circle-exclamation" system={'system'}>
            <a onClick={() => this.recordAnalytics()} href={this.getUrl()}>
              {t(
                "You're almost there! Start capturing errors with just a few lines of code."
              )}
            </a>
          </StyledAlert>
        )}
      </React.Fragment>
    );
  },
});

const StyledAlert = styled(Alert)`
  padding: ${p => p.theme.grid}px ${p => p.theme.grid * 2}px;
  position: relative;
  margin: 0;
  padding-right: ${p => p.theme.grid * 4}px;
  a {
    color: #2f2936;
  }
`;

export default InstallPromptBanner;

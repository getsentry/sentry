import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';

import AlertMessage from 'app/components/alertMessage';
import ConfigStore from 'app/stores/configStore';

const SampleEventBanner = createReactClass({
  displayName: 'sampleEventBanner',
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
    this.sentFirstEvent();
  },

  onConfigStoreUpdate(config) {
    if (config.sentFirstEvent) {
      this.setState({sentFirstEvent: Boolean(config.sentFirstEvent)});
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
      url = `/${organization.slug}/${project.slug}/getting-started/${project.platform}`;
    } else {
      url = `/onboarding/${organization.slug}`;
    }

    return url;
  },

  inSetupFlow() {
    let path = window.location.pathname;

    let notSetupPage =
      path.indexOf('getting-started') === -1 &&
      path.indexOf('onboarding') === -1 &&
      path.indexOf('/projects/new') === -1;

    return !notSetupPage;
  },

  render() {
    let {sentFirstEvent} = this.state;
    let hideBanner = sentFirstEvent || this.inSetupFlow();

    return (
      <React.Fragment>
        {!hideBanner && (
          <AlertMessage
            alert={{
              id: 'id',
              message:
                "You're almost there! Start capturing errors with a few lines of code",
              type: 'warning',
              url: this.getUrl(),
            }}
            system
          />
        )}
      </React.Fragment>
    );
  },
});

export default SampleEventBanner;

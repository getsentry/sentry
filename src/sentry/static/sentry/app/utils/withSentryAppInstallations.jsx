import React from 'react';

import {Client} from 'app/api';
import SentryTypes from 'app/sentryTypes';
import getDisplayName from 'app/utils/getDisplayName';
import SentryAppInstallationStore from 'app/stores/sentryAppInstallationsStore';

const withSentryAppInstallations = WrappedComponent => {
  class WithSentryAppInstallations extends React.Component {
    static displayName = `withSentryAppInstallations(${getDisplayName(
      WrappedComponent
    )})`;

    static propTypes = {
      project: SentryTypes.Project,
    };

    constructor(props) {
      super(props);
      this.api = new Client();
      this.sentryApps = [];
    }

    componentWillMount() {
      this.fetchData();
    }

    componentWillUnmount() {
      this.api.clear();
    }

    fetchData() {
      const slug = this.props.project.organization.slug;

      this.api
        .requestPromise(`/organizations/${slug}/sentry-apps/`)
        .then(data => {
          this.sentryApps = data;
          this.fetchInstallations();
        })
        .catch(this.gracefullyFail);
    }

    fetchInstallations() {
      const slug = this.props.project.organization.slug;

      this.api
        .requestPromise(`/organizations/${slug}/sentry-app-installations/`)
        .then(data => {
          data.forEach(this.addSentryApp);
          SentryAppInstallationStore.load(data);
        })
        .catch(this.gracefullyFail);
    }

    addSentryApp = install => {
      install.sentryApp = this.sentryAppByUuid(install.app.uuid);
    };

    sentryAppByUuid = uuid => {
      return this.sentryApps.find(a => a.uuid === uuid);
    };

    gracefullyFail = () => {
      this.installations = [];
    };

    render() {
      return (
        <WrappedComponent sentryAppInstallations={this.installations} {...this.props} />
      );
    }
  }

  return WithSentryAppInstallations;
};

export default withSentryAppInstallations;

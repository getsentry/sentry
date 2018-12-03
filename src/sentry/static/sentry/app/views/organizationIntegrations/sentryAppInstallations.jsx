import React from 'react';
import {groupBy} from 'lodash';
import parseurl from 'parseurl';
import qs from 'query-string';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import AsyncView from 'app/views/asyncView';
import {Client} from 'app/api';
import SentryApplicationRow from 'app/views/settings/organizationDeveloperSettings/sentryApplicationRow';
import {t} from 'app/locale';

const api = new Client();

export default class SentryAppInstallations extends AsyncView {
  getEndpoints() {
    let {orgId} = this.props;

    return [
      ['applications', `/organizations/${orgId}/sentry-apps/`],
      ['installs', `/organizations/${orgId}/sentry-app-installations/`],
    ];
  }

  redirectUser = data => {
    const {install, app} = data;
    const {installs} = this.state;

    if (!app.redirectUrl) {
      addSuccessMessage(t(`${app.slug} successfully installed.`));
      this.setState({installs: [install, ...installs]});
    } else {
      const url = parseurl({url: app.redirectUrl});
      // Order the query params alphabetically.
      // Otherwise ``qs`` orders them randomly and it's impossible to test.
      const installQuery = JSON.parse(
        JSON.stringify({installationId: install.uuid, code: install.code})
      );
      // const query = Object.assign(qs.parse(url.query), installQuery);
      const query = {...qs.parse(url.query), ...installQuery};
      const redirectUrl = `${url.protocol}//${url.host}${url.pathname}?${qs.stringify(
        query
      )}`;
      window.location.assign(redirectUrl);
    }
  };

  install = app => {
    const {orgId} = this.props;

    const success = install => {
      this.redirectUser({install: {...install}, app: {...app}});
    };

    const error = err => {
      addErrorMessage(t(`Unable to install ${app.name}`));
    };

    const opts = {
      method: 'POST',
      data: {slug: app.slug},
      success,
      error,
    };

    api.request(`/organizations/${orgId}/sentry-app-installations/`, opts);
  };

  uninstall = install => {
    const origInstalls = [...this.state.installs];
    const installs = this.state.installs.filter(i => install.uuid != i.uuid);
    this.setState({installs});

    const success = () => {
      addSuccessMessage(t(`${install.app.slug} successfully uninstalled.`));
    };

    const error = err => {
      this.setState({origInstalls});
      addErrorMessage(t(`Unable to uninstall ${install.app.name}`));
    };

    const opts = {
      method: 'DELETE',
      success,
      error,
    };

    api.request(`/sentry-app-installations/${install.uuid}/`, opts);
  };

  get installsByApp() {
    return groupBy(this.state.installs, install => install.app.slug);
  }

  renderBody() {
    let {orgId} = this.props;
    let isEmpty = this.state.applications.length === 0;

    return (
      <React.Fragment>
        {!isEmpty &&
          this.state.applications.map(app => {
            return (
              <SentryApplicationRow
                key={app.uuid}
                app={app}
                orgId={orgId}
                onInstall={this.install}
                onUninstall={this.uninstall}
                installs={this.installsByApp[app.slug]}
              />
            );
          })}
      </React.Fragment>
    );
  }
}

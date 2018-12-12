import PropTypes from 'prop-types';
import React from 'react';
import {groupBy} from 'lodash';
import parseurl from 'parseurl';
import qs from 'query-string';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import SentryApplicationRow from 'app/views/settings/organizationDeveloperSettings/sentryApplicationRow';
import {t} from 'app/locale';
import {
  installSentryApp,
  uninstallSentryApp,
} from 'app/actionCreators/sentryAppInstallations';
import {openSentryAppPermissionModal} from 'app/actionCreators/modal';
import withApi from 'app/utils/withApi';

class SentryAppInstallations extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    orgId: PropTypes.string.isRequired,
    installs: PropTypes.array.isRequired,
    applications: PropTypes.array.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      installs: this.props.installs,
      applications: this.props.applications,
    };
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
      const query = {...qs.parse(url.query), ...installQuery};
      const redirectUrl = `${url.protocol}//${url.host}${url.pathname}?${qs.stringify(
        query
      )}`;
      window.location.assign(redirectUrl);
    }
  };

  install = app => {
    const {orgId, api} = this.props;
    installSentryApp(api, orgId, app).then(
      data => {
        this.redirectUser({install: {...data}, app: {...app}});
      },
      () => {}
    );
  };

  uninstall = install => {
    const {api} = this.props;
    const origInstalls = [...this.state.installs];
    const installs = this.state.installs.filter(i => install.uuid != i.uuid);

    uninstallSentryApp(api, install).then(
      () => this.setState({installs}),
      () => {
        this.setState({origInstalls});
        addErrorMessage(t(`Unable to uninstall ${install.app.name}`));
      }
    );
  };

  openModal = app => {
    const {orgId} = this.props;
    const onInstall = () => this.install(app);
    openSentryAppPermissionModal({app, orgId, onInstall});
  };

  get installsByApp() {
    return groupBy(this.state.installs, install => install.app.slug);
  }

  render() {
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
                onInstall={() => this.openModal(app)}
                onUninstall={this.uninstall}
                installs={this.installsByApp[app.slug]}
              />
            );
          })}
      </React.Fragment>
    );
  }
}

export default withApi(SentryAppInstallations);
export {SentryAppInstallations};

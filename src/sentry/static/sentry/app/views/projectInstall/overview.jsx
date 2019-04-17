import {browserHistory, Link} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';

import SentryTypes from 'app/sentryTypes';
import {t, tct} from 'app/locale';
import AutoSelectText from 'app/components/autoSelectText';
import PlatformPicker from 'app/components/platformPicker';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import recreateRoute from 'app/utils/recreateRoute';
import withOrganization from 'app/utils/withOrganization';

class ProjectInstallOverview extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    platformData: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.state = {
      data: props.platformData,
    };
  }

  isGettingStarted = () => {
    return location.href.indexOf('getting-started') > 0;
  };

  hasSentry10 = () => {
    return new Set(this.props.organization.features).has('sentry10');
  };

  redirectToDocs = platform => {
    const {orgId, projectId} = this.props.params;
    const prefix = recreateRoute('', {...this.props, stepBack: -3});
    let rootUrl = `${prefix}install`;

    if (this.isGettingStarted()) {
      rootUrl = this.hasSentry10()
        ? `/organizations/${orgId}/projects/${projectId}/getting-started`
        : `/${orgId}/${projectId}/getting-started`;
    }

    browserHistory.push(`${rootUrl}/${platform}/`);
  };

  toggleDsn = () => {
    this.setState({showDsn: !this.state.showDsn});
  };

  render() {
    const {data} = this.state;
    const {orgId, projectId} = this.props.params;

    const issueStreamLink = this.hasSentry10()
      ? `/organizations/${orgId}/issues/#welcome`
      : `/${orgId}/${projectId}/#welcome`;

    return (
      <div>
        <SettingsPageHeader title={t('Configure your application')} />

        <TextBlock>
          {t(
            'Get started by selecting the platform or language that powers your application.'
          )}
        </TextBlock>

        {this.state.showDsn ? (
          <div>
            <div className="control-group">
              <label>{t('DSN')}</label>
              <AutoSelectText className="form-control disabled">
                {data.dsn}
              </AutoSelectText>
            </div>

            <div className="control-group">
              <label>{t('Public DSN')}</label>
              <AutoSelectText className="form-control disabled">
                {data.dsnPublic}
              </AutoSelectText>
              <div className="help-block m-b-1">
                {t('The public DSN should be used with JavaScript.')}
              </div>
              <Link to={issueStreamLink} className="btn btn-primary m-b-1">
                {t('Got it! Take me to the Issue Stream.')}
              </Link>
            </div>
          </div>
        ) : (
          <p>
            <small>
              {tct('Already have things setup? [link:Get your DSN]', {
                link: <a className="btn-xsmall" onClick={this.toggleDsn} />,
              })}
              .
            </small>
          </p>
        )}
        <PlatformPicker setPlatform={this.redirectToDocs} showOther={false} />
        <p>
          {tct(
            `
             For a complete list of
             client integrations, please see [docLink:our in-depth documentation].
          `,
            {
              docLink: <a href="https://docs.sentry.io" />,
            }
          )}
        </p>
      </div>
    );
  }
}

export default withOrganization(ProjectInstallOverview);

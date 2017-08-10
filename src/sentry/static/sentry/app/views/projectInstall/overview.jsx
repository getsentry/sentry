import React from 'react';
import {browserHistory} from 'react-router';

import AutoSelectText from '../../components/autoSelectText';
import PlatformPicker from '../onboarding/project/platformpicker';

import {t, tct} from '../../locale';

const ProjectInstallOverview = React.createClass({
  propTypes: {
    platformData: React.PropTypes.object
  },

  getInitialState() {
    return {
      data: this.props.platformData
    };
  },

  isGettingStarted() {
    return location.href.indexOf('getting-started') > 0;
  },

  redirectToDocs(platform) {
    let {orgId, projectId} = this.props.params;
    let rootUrl = `/${orgId}/${projectId}/settings/install`;

    if (this.isGettingStarted()) {
      rootUrl = `/${orgId}/${projectId}/getting-started`;
    }

    browserHistory.push(`${rootUrl}/${platform}/`);
  },

  toggleDsn() {
    this.setState({showDsn: !this.state.showDsn});
  },

  render() {
    let {data} = this.state;

    return (
      <div>
        <h1>{t('Configure your application')}</h1>
        <p>
          {t(
            'Get started by selecting the platform or language that powers your application.'
          )}
        </p>

        {this.state.showDsn
          ? <div>
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
                <div className="help-block">
                  {t('Your public DSN should be used with JavaScript and ActionScript.')}
                </div>
              </div>
            </div>
          : <p>
              <small>
                {tct('Already have things setup? [link:Get your DSN].', {
                  link: <a onClick={this.toggleDsn} />
                })}
              </small>
            </p>}
        <PlatformPicker setPlatform={this.redirectToDocs} showOther={false} />
        <p>
          {tct(
            `
             For a complete list of
             client integrations, please visit see [docLink:our in-depth documentation].
          `,
            {
              docLink: <a href="https://docs.sentry.io" />
            }
          )}
        </p>
      </div>
    );
  }
});

export default ProjectInstallOverview;

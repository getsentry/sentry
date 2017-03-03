import React from 'react';
import {Link} from 'react-router';

import AutoSelectText from '../../components/autoSelectText';
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

  getIntegrationLink(root, platform, display) {
    let {orgId, projectId} = this.props.params;
    let rootUrl = `/${orgId}/${projectId}/settings/install`;
    if (this.isGettingStarted()) {
      rootUrl = `/${orgId}/${projectId}/getting-started`;
    }
    return (
      <li className={`${root} ${platform}`} key={platform}>
        <span className={`platformicon platformicon-${platform}`}/>
        <Link to={`${rootUrl}/${platform}/`}>
          {display}
        </Link>
      </li>
    );
  },

  toggleDsn() {
    this.setState({showDsn: !this.state.showDsn});
  },

  render() {
    let data = this.state.data;
    let frameworkList = [];
    let languageList = [];
    data.platforms.forEach((platform) => {
      platform.integrations.forEach((integration) => {
        if (integration.type === 'framework')
          frameworkList.push([platform, integration]);
        else if (integration.type === 'language')
          languageList.push([platform, integration]);
      });
    });

    return (
      <div>
        <h1>{t('Configure your application')}</h1>

        <p>{t('Get started by selecting the platform or language that powers your application.')}</p>

        {this.state.showDsn ?
          <div>
            <h3>{t('DSN')}</h3>

            <div className="control-group">
              <label>{t('DSN')}</label>
              <AutoSelectText className="form-control disabled">{data.dsn}</AutoSelectText>
            </div>

            <div className="control-group">
              <label>{t('Public DSN')}</label>
              <AutoSelectText className="form-control disabled">{data.dsnPublic}</AutoSelectText>
              <div className="help-block">{t('Your public DSN should be used with JavaScript and ActionScript.')}</div>
            </div>
          </div>
        :
          <p><small>{tct('Already have things setup? [link:Get your DSN].', {
            link: <a onClick={this.toggleDsn} />
          })}</small></p>
        }

        <h3>{t('Popular')}</h3>

        <ul className="client-platform-list">
          {this.getIntegrationLink('javascript', 'javascript', 'JavaScript')}
          {this.getIntegrationLink('python', 'python-django', 'Django')}
          {this.getIntegrationLink('ruby', 'ruby-rails', 'Rails')}
          {this.getIntegrationLink('node', 'node-express', 'Express')}
          {this.getIntegrationLink('php', 'php-laravel', 'Laravel')}
          {this.getIntegrationLink('php', 'php-symfony2', 'Symfony2')}
          {this.getIntegrationLink('java', 'java-log4j', 'Log4j')}
        </ul>

        <h3>{t('Frameworks')}</h3>
        <ul className="client-platform-list">
          {frameworkList.map((item) => {
            let [platform, integration] = item;
            return this.getIntegrationLink(platform.id, integration.id, integration.name);
          })}
        </ul>

        <h3>{t('Languages')}</h3>
        <ul className="client-platform-list">
          {languageList.map((item) => {
            let [platform, integration] = item;
            return this.getIntegrationLink(platform.id, integration.id, integration.name);
          })}
        </ul>

        <p>
          {tct(`
             For a complete list of
             client integrations, please visit see [docLink:our in-depth documentation].
          `, {
            docLink: <a href="https://docs.sentry.io" />
          })}
        </p>
      </div>
    );
  }
});

export default ProjectInstallOverview;

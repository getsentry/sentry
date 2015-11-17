import React from 'react';
import {Link} from 'react-router';

import AutoSelectText from '../../components/autoSelectText';

const ProjectInstallOverview = React.createClass({
  getInitialState() {
    return {
      data: this.props.platformData
    };
  },

  getIntegrationLink(root, platform, display) {
    let {orgId, projectId} = this.props.params;
    return (
      <li className={`${root} ${platform}`} key={platform}>
        <span className={`platformicon platformicon-${platform}`}/>
        <Link to={`/${orgId}/${projectId}/settings/install/${platform}/`}>
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
        <h1>Configure your application</h1>

        <p>Get started by selecting the platform or language that powers your application.</p>

        {this.state.showDsn ?
          <div>
            <h3>DSN</h3>

            <div className="control-group">
              <label>DSN</label>
              <AutoSelectText className="form-control disabled">{data.dsn}</AutoSelectText>
            </div>

            <div className="control-group">
              <label>Public DSN</label>
              <AutoSelectText className="form-control disabled">{data.dsnPublic}</AutoSelectText>
              <div className="help-block">Your public DSN should be used with JavaScript and ActionScript.</div>
            </div>
          </div>
        :
          <p><small>Already have things setup? <a onClick={this.toggleDsn}>Get your DSN</a>.</small></p>
        }

        <h3>Popular</h3>

        <ul className="client-platform-list">
          {this.getIntegrationLink('javascript', 'javascript', 'JavaScript')}
          {this.getIntegrationLink('python', 'python-django', 'Django')}
          {this.getIntegrationLink('ruby', 'ruby-rails', 'Rails')}
          {this.getIntegrationLink('node', 'node-express', 'Express')}
          {this.getIntegrationLink('php', 'php-laravel', 'Laravel')}
          {this.getIntegrationLink('php', 'php-symfony2', 'Symfony2')}
          {this.getIntegrationLink('java', 'java-log4j', 'Log4j')}
        </ul>

        <h3>Frameworks</h3>
        <ul className="client-platform-list">
          {frameworkList.map((item) => {
            let [platform, integration] = item;
            return this.getIntegrationLink(platform.id, integration.id, integration.name);
          })}
        </ul>

        <h3>Languages</h3>
        <ul className="client-platform-list">
          {languageList.map((item) => {
            let [platform, integration] = item;
            return this.getIntegrationLink(platform.id, integration.id, integration.name);
          })}
        </ul>

        <p>
          <em>Don't see your platform listed here?</em> For a complete list of client integrations,
          please visit see <a href="https://docs.getsentry.com">our in-depth documentation</a>.
        </p>
      </div>
    );
  }
});

export default ProjectInstallOverview;

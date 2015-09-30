import React from "react";
import {Link} from "react-router";

import AutoSelectText from "../../components/autoSelectText";

const ProjectInstallOverview = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  getInitialState() {
    return {
      data: this.props.platformData
    };
  },

  getIntegrationLink(root, platform, display) {
    let params = this.context.router.getCurrentParams();
    return (
      <li className={`${root} ${platform}`} key={platform}>
        <span className={`platformicon platformicon-${platform}`}/>
        <Link to="projectInstallPlatform"
              params={Object.assign({}, params, {platform: platform})}>
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
    let params = Object.assign({}, this.context.router.getCurrentParams());

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
          {this.getIntegrationLink('python', 'python', 'Python')}
          {this.getIntegrationLink('javascript', 'javascript', 'JavaScript')}
          {this.getIntegrationLink('ruby', 'ruby', 'Ruby')}
          {this.getIntegrationLink('ruby', 'rails', 'Rails')}
          {this.getIntegrationLink('php', 'php', 'PHP')}
          {this.getIntegrationLink('python', 'django', 'Django')}
          {this.getIntegrationLink('python', 'flask', 'Flask')}
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
          please visit see <a href="http://docs.getsentry.com">our in-depth documentation</a>.
        </p>

        <Link to="stream" params={params} className="btn btn-lg btn-primary">Skip this step</Link>
      </div>
    );
  }
});

export default ProjectInstallOverview;

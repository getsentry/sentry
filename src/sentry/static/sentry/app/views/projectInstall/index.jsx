import React from "react";
import {Link} from "react-router";

import api from "../../api";
import AutoSelectText from "../../components/autoSelectText";
import LoadingError from "../../components/loadingError";
import LoadingIndicator from "../../components/loadingIndicator";

var ProjectInstall = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  propTypes: {
    setProjectNavSection: React.PropTypes.func.isRequired
  },

  componentWillMount() {
    this.props.setProjectNavSection('settings');
  },

  componentDidMount() {
    this.fetchData();
  },

  getInitialState() {
    return {
      loading: true,
      platformList: null
    };
  },

  fetchData() {
    let {orgId, projectId} = this.context.router.getCurrentParams();
    api.request(`/projects/${orgId}/${projectId}/docs/`, {
      success: (data) => {
        this.setState({
          loading: false,
          data: data
        });
      }
    });
  },

  getPlatformLink(root, platform, display) {
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
    if (this.state.loading)
      return <LoadingIndicator />;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;

    let data = this.state.data;
    let params = Object.assign({}, this.context.router.getCurrentParams());

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
          {this.getPlatformLink('python', 'python', 'Python')}
          {this.getPlatformLink('javascript', 'javascript', 'JavaScript')}
          {this.getPlatformLink('ruby', 'ruby', 'Ruby')}
          {this.getPlatformLink('ruby', 'rails', 'Rails')}
          {this.getPlatformLink('php', 'php', 'PHP')}
          {this.getPlatformLink('python', 'django', 'Django')}
          {this.getPlatformLink('python', 'flask', 'Flask')}
        </ul>

        <h3>Frameworks</h3>

        <h3>Languages</h3>

        <ul className="client-platform-list">
          <li className="bottle python">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"python-bottle"})}>Bottle</Link>
          </li>
          <li className="celery python">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"python-celery"})}>Celery</Link>
          </li>
          <li className="flask python">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"python-flask"})}>Flask</Link>
          </li>
          <li className="pylons python">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"python-pylons"})}>Pylons</Link>
          </li>
          <li className="pyramid python">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"python-pyramid"})}>Pyramid</Link>
          </li>
          <li className="tornado python">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"python-tornado"})}>Tornado</Link>
          </li>
          <li className="node-js">
            <span className="platformicon platformicon-node-js"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"node"})}>Node.js</Link>
          </li>
          <li className="express node-js">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"node-express"})}>Express</Link>
          </li>
          <li className="koa node-js">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"node-koa"})}>Koa</Link>
          </li>
          <li className="connect node-js">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"node-connect"})}>Connect</Link>
          </li>
          <li className="laravel php">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"php-laravel"})}>Laravel</Link>
          </li>
          <li className="monolog php">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"php-monolog"})}>Monolog</Link>
          </li>
          <li className="symfony2 php">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"php-symfony2"})}>Symfony2</Link>
          </li>
          <li className="rack ruby">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"ruby-rack"})}>Rack</Link>
          </li>
          <li className="objective-c">
            <span className="platformicon platformicon-apple"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"objective-c"})}>Objective-C</Link>
          </li>
          <li className="log4j java">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"java-log4j"})}>Log4j</Link>
          </li>
          <li className="log4j2 java">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"java-log4j2"})}>Log4j 2</Link>
          </li>
          <li className="logback java">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"java-logback"})}>Logback</Link>
          </li>
          <li className="app-engine">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"java-appengine"})}>App Engine</Link>
          </li>
          <li className="c-sharp">
            <span className="platformicon platformicon-csharp"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"c-sharp"})}>C#</Link></li>
          <li className="go">
            <span className="platformicon platformicon-go"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"go"})}>Go</Link>
          </li>
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

export default ProjectInstall;

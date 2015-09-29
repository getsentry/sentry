import React from "react";
import {Link} from "react-router";

var ProjectInstall = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  render() {
    let params = Object.assign({}, this.context.router.getCurrentParams());

    return (
      <div>
        <h1>Configure your application</h1>

        <p>Choose a language/platform:</p>

        <h3>Popular</h3>
        <ul className="client-platform-list">
          <li className="python">
            <span className="platformicon platformicon-python"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"python"})}>Python</Link>
          </li>
          <li className="javascript">
            <span className="platformicon platformicon-js"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"javascript"})}>JavaScript</Link>
          </li>
          <li className="ruby">
            <span className="platformicon platformicon-ruby"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"ruby"})}>Ruby</Link>
          </li>
          <li className="rails">
            <span className="platformicon platformicon-rails"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"ruby-rails"})}>Rails</Link>
          </li>
          <li className="java">
            <span className="platformicon platformicon-java"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"java"})}>Java</Link>
          </li>
          <li className="php">
            <span className="platformicon platformicon-php"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"php"})}>PHP</Link>
          </li>
          <li className="django">
            <span className="platformicon platformicon-django"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"python-django"})}>Django</Link>
          </li>
        </ul>

        <h3>Everything else</h3>

        <ul className="client-platform-list">
          <li className="bottle">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"python-bottle"})}>Bottle</Link>
          </li>
          <li className="celery">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"python-celery"})}>Celery</Link>
          </li>
          <li className="flask">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"python-flask"})}>Flask</Link>
          </li>
          <li className="pylons">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"python-pylons"})}>Pylons</Link>
          </li>
          <li className="pyramid">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"python-pyramid"})}>Pyramid</Link>
          </li>
          <li className="tornado">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"python-tornado"})}>Tornado</Link>
          </li>
          <li className="node-js">
            <span className="platformicon platformicon-node-js"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"node"})}>Node.js</Link>
          </li>
          <li className="express">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"node-express"})}>Express</Link>
          </li>
          <li className="koa">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"node-koa"})}>Koa</Link>
          </li>
          <li className="connect">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"node-connect"})}>Connect</Link>
          </li>
          <li className="laravel">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"php-laravel"})}>Laravel</Link>
          </li>
          <li className="monolog">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"php-monolog"})}>Monolog</Link>
          </li>
          <li className="symfony2">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"php-symfony2"})}>Symfony2</Link>
          </li>
          <li className="rack">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"ruby-rack"})}>Rack</Link>
          </li>
          <li className="objective-c">
            <span className="platformicon platformicon-apple"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"objective-c"})}>Objective-C</Link>
          </li>
          <li className="log4j">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"java-log4j"})}>Log4j</Link>
          </li>
          <li className="log4j2">
            <span className="platformicon platformicon-generic"/>
            <Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"java-log4j2"})}>Log4j 2</Link>
          </li>
          <li className="logback">
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

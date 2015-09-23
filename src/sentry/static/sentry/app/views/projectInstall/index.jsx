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

        <ul>
          <li><Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"python"})}>Python</Link></li>
          <li><Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"python-bottle"})}>Bottle</Link></li>
          <li><Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"python-celery"})}>Celery</Link></li>
          <li><Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"python-django"})}>Django</Link></li>
          <li><Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"python-flask"})}>Flask</Link></li>
          <li><Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"python-pylons"})}>Pylons</Link></li>
          <li><Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"python-pyramid"})}>Pyramid</Link></li>
          <li><Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"python-tornado"})}>Tornado</Link></li>
          <li><Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"javascript"})}>JavaScript</Link></li>
          <li><Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"node"})}>Node.js</Link></li>
          <li><Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"node-express"})}>Express</Link></li>
          <li><Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"node-koa"})}>Koa</Link></li>
          <li><Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"node-connect"})}>Connect</Link></li>
          <li><Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"php"})}>PHP</Link></li>
          <li><Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"ruby"})}>Ruby</Link></li>
          <li><Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"objective-c"})}>Objective-C</Link></li>
          <li><Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"java"})}>Java</Link></li>
          <li><Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"c-sharp"})}>C#</Link></li>
          <li><Link to="projectInstallPlatform" params={Object.assign({}, params, {platform:"go"})}>Go</Link></li>
        </ul>

        <p>
          <em>Don't see your platform listed here?</em> For a complete list of client integrations,
          please visit see <a href="http://docs.getsentry.com">our in-depth documentation</a>.
        </p>

        <Link to="stream" params={params} className="btn btn-primary">Skip this step</Link>
      </div>
    );
  }
});

export default ProjectInstall;

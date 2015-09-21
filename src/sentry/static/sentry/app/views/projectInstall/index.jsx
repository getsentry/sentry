import React from "react";

var ProjectInstall = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  render() {
    return (
      <div>
        <h1>Configure your application to send events</h1>

        <p>Choose a language/platform:</p>

        <ul>
          <li><a href="python/">Python</a></li>
          <li><a href="javascript/">JavaScript</a></li>
          <li><a href="nodejs/">Node.js</a></li>
          <li><a href="php/">PHP</a></li>
          <li><a href="ruby/">Ruby</a></li>
          <li><a href="objective/-c">Objective-C</a></li>
          <li><a href="java/">Java</a></li>
          <li><a href="c-sharp/">C#</a></li>
          <li><a href="go/">Go</a></li>
        </ul>

        <p>
          <em>Don't see your platform listed here?</em> For a complete list of client integrations,
          please visit see <a href="http://docs.getsentry.com">our in-depth documentation</a>.
        </p>

        <button className="btn btn-primary">Skip this step</button>
      </div>
    );
  }
});

export default ProjectInstall;

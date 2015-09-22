import React from "react";
import {Link} from "react-router";

var ProjectInstallPlatform = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  static: {
    platforms: {
      python: {
        display: "Python"
      },
      javascript: {
        display: "Javascript"
      },
      nodejs: {
        display: "Node JS"
      },
      php: {
        display: "PHP"
      },
      ruby: {
        display: "Ruby"
      },
      "objective-c": {
        display: "Objective-C"
      },
      "java": {
        display: "Java"
      },
      "c-sharp": {
        display: "C#"
      },
      "go": {
        display: "Go"
      }
    }
  },

  render() {
    let params = this.context.router.getCurrentParams();
    let {platform} = params;

    return (
      <div>
        <h1>Configure {this.static.platforms[platform].display}</h1>

        <p>For pairing Sentry up with Python you can use the Raven for Python (raven-python) library. It is the official standalone Python client for Sentry. It can be used with any modern Python interpreter be it CPython 2.x or 3.x, PyPy or Jython. It’s an Open Source project and available under a very liberal BSD license.</p>

        <h2>Installation</h2>

        <p>If you haven’t already, start by downloading Raven. The easiest way is with pip:</p>

        <pre><code>pip install raven --upgrade</code></pre>


        <h2>Configuration</h2>

        <p>Settings are specified as part of the initialization of the client. The client is a class that can be instanciated with a specific configuration and all reporting can then happen from the instance of that object. Typically an instance is created somewhere globally and then imported as necessary. For getting started all you need is your DSN:</p>

        <pre><code dangerouslySetInnerHTML={{__html:`
from raven import Client
client = Client('https://******@app.getsentry.com/15739
        `}}/></pre>

        <p>For advanced instructions, please consult our <a href="https://docs.getsentry.com/hosted/clients/python/">hosted documentation for Python</a>.</p>

        <Link to="stream" params={params} className="btn btn-primary">Continue</Link>
      </div>
    );
  }
});

export default ProjectInstallPlatform;

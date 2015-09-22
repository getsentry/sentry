import React from "react";
import {Link} from "react-router";

import api from "../../api";

import LoadingIndicator from "../../components/loadingIndicator";

var ProjectInstallPlatform = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  static: {
    platforms: {
      python: {
        display: "Python"
      },
      "python-flask": {
        display: "Flask"
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

  getInitialState() {
    return {
      isFramework: null,
      link: null,
      name: null,
      sdk: null,
      html: '',
      loading: true
    };
  },

  componentDidMount() {
    var params = this.context.router.getCurrentParams();
    api.request(`/projects/${params.orgId}/${params.projectId}/docs/${params.platform}/`, {
      success: (data) => {
        this.setState(Object.assign({loading:false}, data));
      }
    });
  },

  render() {
    let params = this.context.router.getCurrentParams();
    let {platform} = params;

    return (
      <div>
        <h1>Configure {this.static.platforms[platform].display}</h1>

        {this.state.loading
          ? <LoadingIndicator/>
          : (
            <div>
              <p>
                This is a quick getting started guide. For in-depth instructions on integrating Sentry with {this.state.name}, view <a href={this.state.link}>our complete documentation</a>.
              </p>
              <div dangerouslySetInnerHTML={{__html: this.state.html }}/>
              <Link to="stream" params={params} className="btn btn-primary">Continue</Link>
              <Link to="projectInstall" params={params} className="btn btn-default">Back to all platforms</Link>
            </div>
          )
        }

      </div>
    );
  }
});

export default ProjectInstallPlatform;

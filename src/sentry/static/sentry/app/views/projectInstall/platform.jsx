import React from "react";
import {Link} from "react-router";

import api from "../../api";
import LanguageNav from "./languageNav";
import LoadingError from "../../components/loadingError";
import LoadingIndicator from "../../components/loadingIndicator";
import RouteMixin from "../../mixins/routeMixin";

var ProjectInstallPlatform = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  mixins: [RouteMixin],

  getInitialState() {
    let params = this.context.router.getCurrentParams();
    var key = params.platform;
    var integration;
    this.props.platformData.platforms.forEach((platform) => {
      if (integration) {
        return;
      }
      integration = platform.integrations.filter((item) => {
        return item.id == key;
      });
    });

    return {
      loading: true,
      error: false,
      integration: integration,
      html: null
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  routeDidChange() {
    this.setState(this.getInitialState(), this.fetchData);
  },

  fetchData() {
    let {orgId, projectId, platform} = this.context.router.getCurrentParams();
    api.request(`/projects/${orgId}/${projectId}/docs/${platform}/`, {
      success: (data) => {
        this.setState({
          loading: false,
          error: false,
          html: data.html
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true
        });
      }
    });
  },

  getPlatformLink(platform, display) {
    let params = this.context.router.getCurrentParams();
    return (
      <Link
        to="projectInstallPlatform"
        className="list-group-item"
        params={Object.assign({}, params, {platform: platform})}>
          {display || platform}
      </Link>
    );
  },

  render() {
    let params = this.context.router.getCurrentParams();
    let {platform} = params;
    let integration = this.state.integration;

    return (
      <div className="install row">
        <div className="install-content col-md-10">
          <div className="pull-right">
            <a href={integration.link} className="btn btn-default">Full Documentation</a>
          </div>

          <h1>Configure {integration.name}</h1>

          <div>
            <p>
              This is a quick getting started guide. For in-depth instructions on integrating Sentry with {integration.name}, view <a href={integration.link}>our complete documentation</a>.
            </p>

            {this.state.loading ?
              <LoadingIndicator />
            : (this.state.error ?
              <LoadingError onRetry={this.fetchData} />
            :
              <div>
                <div dangerouslySetInnerHTML={{__html: this.state.html}}/>

                <Link to="stream" params={params} className="btn btn-primary btn-lg">Continue</Link>
              </div>
            )}

          </div>
        </div>
        <div className="install-sidebar col-md-2">
          <LanguageNav name="Python" active={platform.indexOf('python') !== -1}>
            {this.getPlatformLink('python', 'Generic')}
            {this.getPlatformLink('python-bottle')}
            {this.getPlatformLink('python-django')}
            {this.getPlatformLink('python-flask')}
            {this.getPlatformLink('python-pylons')}
            {this.getPlatformLink('python-pyramid')}
            {this.getPlatformLink('python-tornado')}
          </LanguageNav>
          <LanguageNav name="JavaScript" active={platform.indexOf('javascript') !== -1}>
            {this.getPlatformLink('javascript', 'Generic')}
          </LanguageNav>
        </div>
      </div>
    );
  }
});

export default ProjectInstallPlatform;

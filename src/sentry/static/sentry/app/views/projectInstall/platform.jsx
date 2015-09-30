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
    var platform;
    this.props.platformData.platforms.forEach((p_item) => {
      if (integration) {
        return;
      }
      integration = p_item.integrations.filter((i_item) => {
        return i_item.id == key;
      })[0];
      if (integration) {
        platform = p_item;
      }
    });

    return {
      loading: true,
      error: false,
      integration: integration,
      platform: platform,
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
    var {integration, platform} = this.state;

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
          {this.props.platformData.platforms.map((p_item) => {
            return (
              <LanguageNav name={p_item.name} active={platform.id === p_item.id}>
                {p_item.integrations.map((i_item) => {
                  return this.getPlatformLink(i_item.id, (i_item.id === p_item.id ? 'Generic' : i_item.name));
                })}
              </LanguageNav>
            );
          })}
        </div>
      </div>
    );
  }
});

export default ProjectInstallPlatform;

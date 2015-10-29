import React from "react";
import {Link} from "react-router";

import api from "../../api";
import LanguageNav from "./languageNav";
import LoadingError from "../../components/loadingError";
import LoadingIndicator from "../../components/loadingIndicator";

const ProjectInstallPlatform = React.createClass({

  getInitialState() {
    let params = this.props.params;
    let key = params.platform;
    let integration;
    let platform;
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

  componentWillReceiveProps(nextProps) {
    if (nextProps.params.platform !== this.props.params.platform) {
      this.setState(this.getInitialState(), this.fetchData);
    }
  },

  fetchData() {
    let {orgId, projectId, platform} = this.props.params;
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
    let {orgId, projectId} = this.props.params;
    return (
      <Link
        to={`/${orgId}/${projectId}/settings/install/${platform}/`}
        className="list-group-item">
          {display || platform}
      </Link>
    );
  },

  render() {
    let {integration, platform} = this.state;

    return (
      <div className="install row">
        <div className="install-content col-md-10">
          <div className="box">
            <div className="box-header">
              <div className="pull-right">
                <a href={integration.link} className="btn btn-sm btn-default">Full Documentation</a>
              </div>

              <h3>Configure {integration.name}</h3>
            </div>
            <div className="box-content with-padding">
              <p>
                This is a quick getting started guide. For in-depth instructions on integrating Sentry with {integration.name}, view <a href={integration.link}>our complete documentation</a>.
              </p>

              {this.state.loading ?
                <LoadingIndicator />
              : (this.state.error ?
                <LoadingError onRetry={this.fetchData} />
              :
                <div dangerouslySetInnerHTML={{__html: this.state.html}}/>
              )}

            </div>
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

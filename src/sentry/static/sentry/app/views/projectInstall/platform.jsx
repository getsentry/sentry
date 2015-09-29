import React from "react";
import {Link} from "react-router";

import api from "../../api";
import LanguageNav from "./languageNav";
import LoadingError from "../../components/loadingError";
import LoadingIndicator from "../../components/loadingIndicator";
import jQuery from "jquery";
import RouteMixin from "../../mixins/routeMixin";

var ProjectInstallPlatform = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  mixins: [RouteMixin],

  getInitialState() {
    return {
      loading: true,
      data: null
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  componentWillMount() {
    jQuery(document.body).addClass("white-bg");
  },

  componentWillUnmount() {
    jQuery(document.body).removeClass("white-bg");
  },

  routeDidChange() {
    this.setState({
      loading: true
    }, this.fetchData);
  },

  fetchData() {
    let {orgId, projectId, platform} = this.context.router.getCurrentParams();
    api.request(`/projects/${orgId}/${projectId}/docs/${platform}/`, {
      success: (data) => {
        this.setState({
          loading: false,
          error: false,
          data: data
        });
      },
      error: () => {
        this.setSTate({
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
    if (this.state.loading)
      return <LoadingIndicator />;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;

    let params = this.context.router.getCurrentParams();
    let {platform} = params;
    let data = this.state.data;

    return (
      <div className="install row">
        <div className="install-content col-md-10">
          <div className="pull-right">
            <a href={data.link} className="btn btn-default">Full Documentation</a>
          </div>

          <h1>Configure {data.name}</h1>

          <div>
            <p>
              This is a quick getting started guide. For in-depth instructions on integrating Sentry with {data.name}, view <a href={data.link}>our complete documentation</a>.
            </p>
            <div dangerouslySetInnerHTML={{__html: data.html}}/>
            <Link to="stream" params={params} className="btn btn-primary btn-lg">Continue</Link>
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

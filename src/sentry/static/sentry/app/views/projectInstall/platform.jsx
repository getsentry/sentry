import React from 'react';

import ApiMixin from '../../mixins/apiMixin';
import LanguageNav from './languageNav';
import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';
import NotFound from '../../components/errors/notFound';
import Link from '../../components/link';
import {t, tct} from '../../locale';

const ProjectInstallPlatform = React.createClass({
  propTypes: {
    platformData: React.PropTypes.object.isRequired
  },

  mixins: [
    ApiMixin
  ],

  getInitialState(props) {
    props = props || this.props;
    let params = props.params;
    let key = params.platform;
    let integration;
    let platform;

    props.platformData.platforms.forEach((p_item) => {
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
    $(window).scrollTop(0);
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.params.platform !== this.props.params.platform) {
      this.setState(this.getInitialState(nextProps), this.fetchData);
      $(window).scrollTop(0);
    }
  },

  isGettingStarted() {
    return location.href.indexOf('getting-started') > 0;
  },

  fetchData() {
    let {orgId, projectId, platform} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/docs/${platform}/`, {
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
        key={platform}
        to={`/${orgId}/${projectId}/settings/install/${platform}/`}
        className="list-group-item">
          {display || platform}
      </Link>
    );
  },

  renderSidebar() {
    let platform = this.state.platform;
    return (
      <div className="install-sidebar col-md-2">
        {this.props.platformData.platforms.map((p_item) => {
          return (
            <LanguageNav key={p_item.id} name={p_item.name} active={platform && platform.id === p_item.id}>
              {p_item.integrations.map((i_item) => {
                return this.getPlatformLink(i_item.id, (i_item.id === p_item.id ? t('Generic') : i_item.name));
              })}
            </LanguageNav>
          );
        })}
      </div>
    );
  },

  renderBody() {
    let {integration, platform} = this.state;
    let {orgId, projectId} = this.props.params;

    if (!integration || !platform) {
      return <NotFound />;
    }

    return (
      <div className="box">
        <div className="box-header">
          <div className="pull-right">
            <a href={integration.link} className="btn btn-sm btn-default">{t('Full Documentation')}</a>
          </div>

          <h3>{t('Configure %(integration)s', {integration: integration.name})}</h3>
        </div>
        <div className="box-content with-padding">
          <p>
            {tct(`
             This is a quick getting started guide. For in-depth instructions
             on integrating Sentry with [integration], view
             [docLink:our complete documentation].
            `, {
              integration: integration.name,
              docLink: <a href={integration.link} />
            })}
          </p>

          {this.state.loading ?
            <LoadingIndicator />
          : (this.state.error ?
            <LoadingError onRetry={this.fetchData} />
          :
            <div dangerouslySetInnerHTML={{__html: this.state.html}}/>
          )}

          {this.isGettingStarted() &&
            // Using <a /> instead of <Link /> as hashchange events are not
            // triggered when switching views within React Router
            <p>
              <Link
                to={`/${orgId}/${projectId}/#welcome`}
                className="btn btn-primary btn-lg">
                  {t('Got it! Take me to the Issue Stream.')}
              </Link>
            </p>}
        </div>
      </div>
    );
  },

  render() {
    return (
      <div className="install row">
        <div className="install-content col-md-10">
          {this.renderBody()}
        </div>
        {this.renderSidebar()}
      </div>
    );
  }
});

export default ProjectInstallPlatform;

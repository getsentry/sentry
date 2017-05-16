import React from 'react';
import ApiMixin from '../mixins/apiMixin';
import {t} from '../locale';
import PluginList from '../components/pluginList';
// import PluginConfig from '../components/pluginConfig';

const ProjectReleaseTracking = React.createClass({
  propTypes: {
    // these are not declared as required of issues with cloned elements
    // not initially defining them (though they are bound before) ever
    // rendered
    organization: React.PropTypes.object,
    project: React.PropTypes.object
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      pluginList: [],
      webhookUrl: '',
      token: ''
    };
  },

  componentDidMount() {
    this.fetchData();
    this.fetchToken();
  },

  fetchToken() {
    let {orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/releases/token/`, {
      method: 'GET',
      success: data =>
        this.setState({
          webhookUrl: data.webhookUrl,
          token: data.token
        }),
      error: () => {
        this.setState({
          error: true
        });
      }
    });
  },

  fetchData() {
    let {orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/plugins/`, {
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          pluginList: data.filter(p => p.type === 'release-tracking')
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  onEnablePlugin(plugin) {
    this.setState({
      pluginList: this.state.pluginList.map(p => {
        if (p.id !== plugin.id) return p;
        return {
          ...plugin,
          enabled: true
        };
      })
    });
  },

  onDisablePlugin(plugin) {
    this.setState({
      pluginList: this.state.pluginList.map(p => {
        if (p.id !== plugin.id) return p;
        return {
          ...plugin,
          enabled: false
        };
      })
    });
  },

  onSubmit(evt) {
    evt.preventDefault();
    this.regenerateToken();
  },

  regenerateToken() {
    let {orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/releases/token/`, {
      method: 'POST',
      data: {project: projectId},
      success: data =>
        this.setState({
          token: data.token,
          webhookUrl: data.webhookUrl
        }),
      error: () => {
        this.setState({
          error: true
        });
      }
    });
  },

  getReleaseWebhookIntructions() {
    let webhookUrl = this.state.webhookUrl;
    return (
      'curl ' +
      webhookUrl +
      '\n  ' +
      '-X POST \\' +
      '\n  ' +
      "-H 'Content-Type: application/json' \\" +
      '\n  ' +
      '-d \'{"version": "abcdefg"}\''
    );
  },

  getReleaseClientConfigurationIntructions() {
    return (
      '// See SDK documentation for language specific usage.' +
      '\n' +
      "Raven.config('your dsn', {" +
      '\n' +
      '  ' +
      "release: '0e4fdef81448dcfa0e16ecc4433ff3997aa53572'" +
      '\n' +
      '});'
    );
  },

  render() {
    // let {orgId, projectId} = this.props.params;
    let {organization, project} = this.props;
    let {pluginList} = this.state;
    return (
      <div>
        <h2>{t('Release Tracking')}</h2>
        <p>
          Configure release tracking for this project to automatically record new releases of your application.
        </p>
        <div className="box">
          <div className="box-header">
            <h3>{t('Client Configuration')}</h3>
          </div>
          <div className="box-content with-padding">
            <p>
              Start by binding the <code>release</code> attribute in your application:
            </p>
            <pre>{this.getReleaseClientConfigurationIntructions()}</pre>
            <p>
              This will annotate each event with the version of your application, as well as
              automatically create a release entity in the system the first time it's seen.
            </p>
            <p>
              In addition you may configure a release hook (or use our API) to push a release
              and include additional metadata with it.
            </p>
          </div>
        </div>

        <div className="box">
          <div className="box-header">
            <h3>{t('Token')}</h3>
          </div>
          <div className="box-content with-padding">
            <form>
              <p>
                Your token is a unique secret which is used to generate deploy hook URLs. If a service becomes compromised, you should regenerate the token and re-configure any deploy hooks with the newly generated URL.
              </p>
              <p>
                <code style={{display: 'inlineBlock'}} className="auto-select">
                  {this.state.token}
                </code>
                <button
                  type="submit"
                  className="btn btn-sm btn-danger"
                  name="op"
                  value="regenerate-token"
                  onClick={this.onSubmit}>
                  Regenerate Token
                </button>
              </p>
            </form>
          </div>
        </div>

        <div className="box">
          <div className="box-header">
            <h3>{t('Webhook')}</h3>
          </div>
          <div className="box-content with-padding">
            <form>
              <p>
                If you simply want to integrate with an existing system, sometimes its easiest just to use a webhook.
              </p>

              <pre className="auto-select">{this.state.webhookUrl}</pre>

              <p>
                The release webhook accepts the same parameters as the "Create a new Release" API endpoint, for example:
              </p>

              <pre className="auto-select">{this.getReleaseWebhookIntructions()}</pre>
            </form>
          </div>
        </div>

        <PluginList
          organization={organization}
          project={project}
          pluginList={pluginList}
          onEnablePlugin={this.onEnablePlugin}
          onDisablePlugin={this.onDisablePlugin}
        />
        <div className="box">
          <div className="box-header">
            <h3>{t('API')}</h3>
          </div>
          <div className="box-content with-padding">
            <p>
              You can notify Sentry when you release new versions of your application via our HTTP API.
            </p>

            <p>
              See the
              {' '}
              <a href="https://docs.sentry.io/hosted/api/releases/">
                Releases API documentation
              </a>
              {' '}
              for more information.
            </p>
          </div>
        </div>
      </div>
    );
  }
});

export default ProjectReleaseTracking;

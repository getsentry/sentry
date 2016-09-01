import React from 'react';
import AlertActions from '../actions/alertActions';
import ApiMixin from '../mixins/apiMixin';
import LoadingIndicator from '../components/loadingIndicator';
import plugins from '../plugins';
import {t} from '../locale';

const IssuePluginConfiguration = React.createClass({
  propTypes: {
    organization: React.PropTypes.object.isRequired,
    project: React.PropTypes.object.isRequired,
    plugins: React.PropTypes.array.isRequired
  },

  mixins: [ApiMixin],

  componentWillMount() {
    this.setState({
      loading: true,
    }, () => {
      plugins.loadAll(this.props.plugins, () => {
        this.setState({loading: false});
      });
    });
  },

  componentWillReceiveProps(nextProps) {
    this.setState({
      loading: true,
    }, () => {
      plugins.loadAll(nextProps.plugins, () => {
        this.setState({loading: false});
      });
    });
  },

  getPluginEndpoint(data) {
    let org = this.props.organization;
    let project = this.props.project;
    return (
      `/projects/${org.slug}/${project.slug}/plugins/${data.id}/`
    );
  },

  disablePlugin(data) {
    this.api.request(this.getPluginEndpoint(data), {
      method: 'DELETE',
      success: () => {
        // When this whole page is a react view, this won't be necessary
        window.location.reload();
      },
      error: (error) => {
        AlertActions.addAlert({
          message: t('There was an error disabling the plugin'),
          type: 'error'
        });
      }
    });
  },

  render() {
    if (!this.props.plugins.length) {
      return null;
    }
    if (this.state.loading)
      return <LoadingIndicator />;

    return (
      <div>
        {this.props.plugins.map((data) => {
          let plugin = plugins.get(data);
          return (
            <div className="box" key={data.id}>
              <div className="box-header">
                {data.canDisable && data.enabled &&
                  <button className="btn btn-sm btn-default pull-right"
                          onClick={this.disablePlugin.bind(this, data)}>{t('Disable')}</button>}
                <h3>{plugin.name}</h3>
              </div>
              <div className="box-content with-padding">
                {plugin.renderSettings(this.props)}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
});

export default IssuePluginConfiguration;

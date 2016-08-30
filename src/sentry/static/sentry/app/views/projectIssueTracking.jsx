import React from 'react';
import AlertActions from '../actions/alertActions';
import ApiMixin from '../mixins/apiMixin';
import PluginConfigForm from '../components/plugins/pluginConfigureForm';
import {t} from '../locale';

const IssuePluginConfiguration = React.createClass({
  propTypes: {
    organization: React.PropTypes.object.isRequired,
    project: React.PropTypes.object.isRequired,
    plugins: React.PropTypes.array.isRequired
  },

  mixins: [ApiMixin],

  getPluginEndpoint(plugin) {
    let org = this.props.organization;
    let project = this.props.project;
    return (
      `/projects/${org.slug}/${project.slug}/plugins/${plugin.id}/`
    );
  },

  disablePlugin(plugin) {
    this.api.request(this.getPluginEndpoint(plugin), {
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
    return (
      <div>
        {this.props.plugins.map((plugin) => {
          return (
            <div className="box" key={plugin.id}>
              <div className="box-header">
                {plugin.canDisable && plugin.enabled &&
                  <button className="btn btn-sm btn-default pull-right"
                          onClick={this.disablePlugin.bind(this, plugin)}>{t('Disable')}</button>}
                <h3>{plugin.title}</h3>
              </div>
              <div className="box-content with-padding">
                <PluginConfigForm plugin={plugin} {...this.props}/>
              </div>
            </div>
          );
        })}
      </div>);
  }
});

export default IssuePluginConfiguration;

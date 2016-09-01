import React from 'react';
import AlertActions from '../actions/alertActions';
import ApiMixin from '../mixins/apiMixin';
import plugin from '../plugin';
import {t} from '../locale';

const IssuePluginConfiguration = React.createClass({
  propTypes: {
    organization: React.PropTypes.object.isRequired,
    project: React.PropTypes.object.isRequired,
    plugins: React.PropTypes.array.isRequired
  },

  mixins: [ApiMixin],

  getPluginEndpoint(pluginData) {
    let org = this.props.organization;
    let project = this.props.project;
    return (
      `/projects/${org.slug}/${project.slug}/plugins/${pluginData.id}/`
    );
  },

  disablePlugin(pluginData) {
    this.api.request(this.getPluginEndpoint(pluginData), {
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
        {this.props.plugins.map((p) => {
          let pluginObj = plugin.get(p.id);
          return (
            <div className="box" key={p.id}>
              <div className="box-header">
                {p.canDisable && p.enabled &&
                  <button className="btn btn-sm btn-default pull-right"
                          onClick={this.disablePlugin.bind(this, plugin)}>{t('Disable')}</button>}
                <h3>{p.title}</h3>
              </div>
              <div className="box-content with-padding">
                {pluginObj.renderSettings(Object.assign({
                  plugin: p,
                }, this.props))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
});

export default IssuePluginConfiguration;

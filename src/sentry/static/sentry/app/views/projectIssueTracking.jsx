import React from 'react';
import AlertActions from '../actions/alertActions';
import ApiMixin from '../mixins/apiMixin';
import IssuePluginConfigForm from '../components/plugins/pluginConfigureForm';
import {t} from '../locale';

const IssuePluginConfiguration = React.createClass({
  propTypes: {
    organization: React.PropTypes.object.isRequired,
    project: React.PropTypes.object.isRequired,
    plugins: React.PropTypes.array.isRequired
  },

  mixins: [ApiMixin],

  getPluginDisableEndpoint(plugin) {
    let org = this.props.organization;
    let project = this.props.project;
    return ('/projects/' + org.slug + '/' + project.slug +
            '/plugin/' + plugin.slug + '/disable/');
  },

  disablePlugin(plugin) {
    this.api.request(this.getPluginDisableEndpoint(plugin), {
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
            <div className="box" key={plugin.slug}>
              <div className="box-header">
                {plugin.can_disable && plugin.is_enabled &&
                  <button className="btn btn-sm btn-default pull-right"
                          onClick={this.disablePlugin.bind(this, plugin)}>{t('Disable')}</button>}
                <h3>{plugin.title}</h3>
              </div>
              <div className="box-content with-padding">
                <IssuePluginConfigForm plugin={plugin} key={plugin.slug} {...this.props}/>
              </div>
            </div>
          );
        })}
      </div>);
  }
});

export default IssuePluginConfiguration;

import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import InactivePlugins from './inactivePlugins';
import IndicatorStore from '../stores/indicatorStore';
import PluginConfig from './pluginConfig';
import {t} from '../locale';

export default React.createClass({
  propTypes: {
    organization: React.PropTypes.object.isRequired,
    project: React.PropTypes.object.isRequired,
    pluginList: React.PropTypes.array.isRequired,
    onDisablePlugin: React.PropTypes.func.isRequired,
    onEnablePlugin: React.PropTypes.func.isRequired
  },

  mixins: [ApiMixin],

  enablePlugin(plugin) {
    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
    let {organization, project} = this.props;
    this.api.request(
      `/projects/${organization.slug}/${project.slug}/plugins/${plugin.id}/`,
      {
        method: 'POST',
        success: () => this.props.onEnablePlugin(plugin),
        error: error => {
          IndicatorStore.add(t('Unable to save changes. Please try again.'), 'error');
        },
        complete: () => {
          IndicatorStore.remove(loadingIndicator);
        }
      }
    );
  },

  onDisablePlugin(plugin) {
    this.props.onDisablePlugin(plugin);
  },

  render() {
    let {organization, pluginList, project} = this.props;

    if (!pluginList.length) {
      return (
        <div className="panel panel-default">
          <div className="panel-body p-b-0">
            <p>{"Oops! Looks like there aren't any available integrations installed."}</p>
          </div>
        </div>
      );
    }

    return (
      <div>
        {pluginList.filter(p => p.enabled).map(data => {
          return (
            <PluginConfig
              data={data}
              organization={organization}
              project={project}
              key={data.id}
              onDisablePlugin={this.onDisablePlugin.bind(this, data)}
            />
          );
        })}
        <InactivePlugins
          plugins={pluginList.filter(p => !p.enabled)}
          onEnablePlugin={this.enablePlugin}
        />
      </div>
    );
  }
});

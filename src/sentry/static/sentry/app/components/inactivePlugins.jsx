import React from 'react';

import {t} from '../locale';

export default React.createClass({
  propTypes: {
    plugins: React.PropTypes.array.isRequired,
    onEnablePlugin: React.PropTypes.func.isRequired
  },

  enablePlugin(plugin) {
    return this.props.onEnablePlugin(plugin, true);
  },

  render() {
    let plugins = this.props.plugins;
    if (plugins.length === 0) return null;
    return (
      <div className="box">
        <div className="box-header">
          <h3>{t('Inactive Integrations')}</h3>
        </div>
        <div className="box-content with-padding">
          <ul className="integration-list">
            {plugins.map(plugin => {
              return (
                <li key={plugin.id}>
                  <button
                    onClick={this.enablePlugin.bind(this, plugin)}
                    className={`ref-plugin-enable-${plugin.id}`}>
                    <div className={'icon-integration icon-' + plugin.id} />
                    {plugin.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }
});

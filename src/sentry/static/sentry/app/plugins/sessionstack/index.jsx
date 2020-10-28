import React from 'react';

import BasePlugin from 'app/plugins/basePlugin';

import Settings from './components/settings';

class SessionStackPlugin extends BasePlugin {
  renderSettings(props) {
    return <Settings plugin={this.plugin} {...props} />;
  }
}

SessionStackPlugin.displayName = 'SessionStack';

export default SessionStackPlugin;

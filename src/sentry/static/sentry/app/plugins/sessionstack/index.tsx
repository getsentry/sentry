import React from 'react';

import BasePlugin from 'app/plugins/basePlugin';

import Settings from './components/settings';

class SessionStackPlugin extends BasePlugin {
  displayName = 'SessionStack';
  //should never be be called since this is a non-issue plugin
  renderGroupActions() {
    return null;
  }
  
  renderSettings(props: Parameters<typeof BasePlugin.prototype.renderSettings>[0]) {
    return <Settings plugin={this.plugin} {...props} />;
  }
}

export default SessionStackPlugin;

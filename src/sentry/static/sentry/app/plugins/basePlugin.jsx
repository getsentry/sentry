import React from 'react';

import Settings from 'app/plugins/components/settings';

class BasePlugin {
  constructor(data) {
    Object.assign(this, data);
  }

  renderSettings(props) {
    return <Settings plugin={this} {...props} />;
  }
}

BasePlugin.DefaultSettings = Settings;

export default BasePlugin;

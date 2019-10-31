import React from 'react';
import {plugins} from 'sentry';

import Settings from './components/settings';
import SessionStackContextType from './contexts/sessionstack';

class SessionStackPlugin extends plugins.BasePlugin {
  renderSettings(props) {
    return <Settings plugin={this} {...props} />;
  }
}

SessionStackPlugin.displayName = 'SessionStack';

plugins.add('sessionstack', SessionStackPlugin);
plugins.addContext('sessionstack', SessionStackContextType);

export default SessionStackPlugin;

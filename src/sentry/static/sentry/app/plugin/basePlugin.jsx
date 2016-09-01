import React from 'react';

import Settings from './components/settings';

class BasePlugin {
    /**
     * Return a list of hooks which should be registered.
     *
     * Sentry will automatically wire these up safely upon
     * instantiation of this plugin.
     */
    getHooks() {
        return [
            // [hook name, callback]
        ];
    }

    renderSettings(props) {
        return <Settings {... props} />;
    }
}

BasePlugin.DefaultSettings = Settings;

export default BasePlugin;

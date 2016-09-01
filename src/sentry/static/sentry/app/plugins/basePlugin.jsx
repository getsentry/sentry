import React from 'react';

import Settings from './components/settings';

class BasePlugin {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.config = data.config;
        this.metadata = data.metdata;
    }

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
        return <Settings plugin={this} {...props} />;
    }
}

BasePlugin.DefaultSettings = Settings;

export default BasePlugin;

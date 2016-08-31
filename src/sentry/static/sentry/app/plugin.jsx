import React from 'react';

import Settings from './plugin/settings';

class Plugin {
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

Plugin.DefaultSettings = Settings;

export class DefaultPlugin extends Plugin {}
export default Plugin;

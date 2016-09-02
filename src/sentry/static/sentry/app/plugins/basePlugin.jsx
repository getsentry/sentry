import React from 'react';

import Settings from './components/settings';

class BasePlugin {
    constructor(data) {
        Object.keys(data).forEach((key) => {
            this[key] = data[key];
        });
    }

    renderSettings(props) {
        return <Settings plugin={this} {...props} />;
    }
}

BasePlugin.DefaultSettings = Settings;

export default BasePlugin;

// Required for tooltip
import 'jquery';
import 'bootstrap/js/tooltip';
import './less/sentry.less';

import ConfigStore from '../static/app/stores/configStore';

ConfigStore.loadInitialData({
  gravatarBaseUrl: 'https://secure.gravatar.com',
  version: {
    current: 'Storybook',
  },
});

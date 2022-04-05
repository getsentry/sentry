import ConfigStore from 'sentry/stores/configStore';

import './less/sentry.less';

ConfigStore.loadInitialData({
  gravatarBaseUrl: 'https://secure.gravatar.com',

  version: {
    current: 'Storybook',
  },
  user: {
    options: {},
  },
});

import './less/sentry.less';

import ConfigStore from '../src/sentry/static/sentry/app/stores/configStore';

ConfigStore.loadInitialData({
  gravatarBaseUrl: 'https://secure.gravatar.com',

  version: {
    current: 'Storybook',
  },
  user: {
    options: {},
  },
});

import './less/sentry.less';

import LegacyConfigStore from '../static/app/stores/configStore';

LegacyConfigStore.loadInitialData({
  gravatarBaseUrl: 'https://secure.gravatar.com',

  version: {
    current: 'Storybook',
  },
  user: {
    options: {},
  },
});

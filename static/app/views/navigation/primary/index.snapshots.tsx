import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';
import {ConfigStore} from 'sentry/stores/configStore';

import {Navigation} from '..';

describe('PrimaryNavigation', () => {
  describe.each(['light', 'dark'] as const)('theme-%s', type => {
    beforeAll(() => {
      ConfigStore.set('theme', type);
    });

    it.snapshot('Primary Navigaton: %s', () => {
      return (
        <ThemeAndStyleProvider>
          <Navigation />
        </ThemeAndStyleProvider>
      );
    });
  });
});

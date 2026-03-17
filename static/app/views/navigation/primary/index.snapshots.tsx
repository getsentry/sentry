import {OrganizationFixture} from 'sentry-fixture/organization';

import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';
import {ConfigStore} from 'sentry/stores/configStore';
import * as useMedia from 'sentry/utils/useMedia';
import {Navigation} from 'sentry/views/navigation/index';
import {OrganizationContext} from 'sentry/views/organizationContext';

describe('PrimaryNavigation', () => {
  describe.each(['light', 'dark'] as const)('theme-%s', type => {
    describe.each(['desktop', 'mobile'] as const)('layout-%s', layout => {
      beforeAll(() => {
        ConfigStore.set('theme', type);
        // We query matchMedia < md breakpoint to determine nav layout,
        // returning false means we are on a desktop layout
        jest.spyOn(useMedia, 'useMedia').mockReturnValue(layout === 'desktop');
      });

      it.snapshot('Navigaton: %s', () => {
        return (
          <ThemeAndStyleProvider>
            <OrganizationContext.Provider value={OrganizationFixture()}>
              <Navigation />
            </OrganizationContext.Provider>
          </ThemeAndStyleProvider>
        );
      });

      it.snapshot('PageFrame Navigation: %s', () => {
        return (
          <ThemeAndStyleProvider>
            <OrganizationContext.Provider
              value={OrganizationFixture({features: ['page-frame']})}
            >
              <Navigation />
            </OrganizationContext.Provider>
          </ThemeAndStyleProvider>
        );
      });
    });
  });
});

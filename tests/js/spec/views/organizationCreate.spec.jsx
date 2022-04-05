import {mountWithTheme} from 'sentry-test/enzyme';

import LegacyConfigStore from 'sentry/stores/configStore';
import OrganizationCreate from 'sentry/views/organizationCreate';

describe('OrganizationCreate', function () {
  let privacyUrl, termsUrl;

  beforeEach(() => {
    termsUrl = LegacyConfigStore.get('termsUrl', null);
    privacyUrl = LegacyConfigStore.get('privacyUrl', null);
  });

  afterEach(() => {
    LegacyConfigStore.set('termsUrl', termsUrl);
    LegacyConfigStore.set('privacyUrl', privacyUrl);
  });

  describe('render()', function () {
    it('renders without terms', function () {
      LegacyConfigStore.set('termsUrl', null);
      LegacyConfigStore.set('privacyUrl', null);
      const wrapper = mountWithTheme(<OrganizationCreate />, {
        context: {router: TestStubs.router()},
      });
      expect(wrapper).toSnapshot();
    });

    it('renders with terms', function () {
      LegacyConfigStore.set('termsUrl', 'https://example.com/terms');
      LegacyConfigStore.set('privacyUrl', 'https://example.com/privacy');
      const wrapper = mountWithTheme(<OrganizationCreate />, {
        context: {router: TestStubs.router()},
      });
      expect(wrapper).toSnapshot();
    });
  });
});

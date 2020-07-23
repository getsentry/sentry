import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import ConfigStore from 'app/stores/configStore';
import OrganizationCreate from 'app/views/organizationCreate';

describe('OrganizationCreate', function() {
  let privacyUrl, termsUrl;

  beforeEach(() => {
    termsUrl = ConfigStore.get('termsUrl', null);
    privacyUrl = ConfigStore.get('privacyUrl', null);
  });

  afterEach(() => {
    ConfigStore.set('termsUrl', termsUrl);
    ConfigStore.set('privacyUrl', privacyUrl);
  });

  describe('render()', function() {
    it('renders without terms', function() {
      ConfigStore.set('termsUrl', null);
      ConfigStore.set('privacyUrl', null);
      const wrapper = mountWithTheme(<OrganizationCreate />, {
        context: {router: TestStubs.router()},
      });
      expect(wrapper).toSnapshot();
      expect(wrapper).toMatchSnapshot();
    });

    it('renders with terms', function() {
      ConfigStore.set('termsUrl', 'https://example.com/terms');
      ConfigStore.set('privacyUrl', 'https://example.com/privacy');
      const wrapper = mountWithTheme(<OrganizationCreate />, {
        context: {router: TestStubs.router()},
      });
      expect(wrapper).toSnapshot();
      expect(wrapper).toMatchSnapshot();
    });
  });
});

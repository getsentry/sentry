import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import AdminSettings from 'app/views/admin/adminSettings';

// TODO(dcramer): this doesnt really test anything as we need to
// mock the API Response/wait on it
describe('AdminSettings', function() {
  describe('render()', function() {
    beforeEach(() => {
      Client.addMockResponse({
        url: '/internal/options/',
        body: {
          'system.url-prefix': {
            field: {
              disabledReason: 'diskPriority',
              default: '',
              required: true,
              disabled: true,
              allowEmpty: true,
              isSet: true,
            },
            value: 'https://sentry.example.com',
          },
          'system.admin-email': {
            field: {
              disabledReason: 'diskPriority',
              default: null,
              required: true,
              disabled: true,
              allowEmpty: false,
              isSet: true,
            },
            value: 'foo@example.com',
          },
          'system.support-email': {
            field: {
              disabledReason: 'diskPriority',
              default: null,
              required: true,
              disabled: true,
              allowEmpty: false,
              isSet: true,
            },
            value: 'foo@example.com',
          },
          'system.security-email': {
            field: {
              disabledReason: 'diskPriority',
              default: null,
              required: true,
              disabled: true,
              allowEmpty: false,
              isSet: true,
            },
            value: 'foo@example.com',
          },
          'system.rate-limit': {
            field: {
              disabledReason: 'diskPriority',
              default: 0,
              required: true,
              disabled: true,
              allowEmpty: false,
              isSet: true,
            },
            value: 25,
          },
          'auth.allow-registration': {
            field: {
              disabledReason: 'diskPriority',
              default: false,
              required: true,
              disabled: true,
              allowEmpty: false,
              isSet: true,
            },
            value: true,
          },
          'auth.ip-rate-limit': {
            field: {
              disabledReason: 'diskPriority',
              default: 0,
              required: true,
              disabled: true,
              allowEmpty: false,
              isSet: true,
            },
            value: 25,
          },
          'auth.user-rate-limit': {
            field: {
              disabledReason: 'diskPriority',
              default: 0,
              required: true,
              disabled: true,
              allowEmpty: false,
              isSet: true,
            },
            value: 25,
          },
          'api.rate-limit.org-create': {
            field: {
              disabledReason: 'diskPriority',
              default: 0,
              required: true,
              disabled: true,
              allowEmpty: false,
              isSet: true,
            },
            value: 25,
          },
        },
      });
    });

    it('renders', function() {
      const wrapper = mountWithTheme(<AdminSettings params={{}} />, {
        context: {
          router: TestStubs.router(),
        },
      });
      expect(wrapper).toSnapshot();
    });
  });
});

import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import AdminQuotas from 'app/views/admin/adminQuotas';

// TODO(dcramer): this doesnt really test anything as we need to
// mock the API Response/wait on it
describe('AdminQuotas', function() {
  describe('render()', function() {
    beforeEach(() => {
      Client.addMockResponse({
        url: '/internal/quotas/',
        body: {
          options: {
            'system.rate-limit': 0,
          },
          backend: 'sentry.quotas.redis.RedisQuota',
        },
      });
    });

    it('renders', function() {
      const wrapper = shallow(<AdminQuotas params={{}} />, {
        context: {
          router: TestStubs.router(),
        },
      });
      expect(wrapper).toMatchSnapshot();
    });
  });
});

import {render} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import AdminQuotas from 'sentry/views/admin/adminQuotas';

// TODO(dcramer): this doesnt really test anything as we need to
// mock the API Response/wait on it
describe('AdminQuotas', function () {
  describe('render()', function () {
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

    it('renders', function () {
      MockApiClient.addMockResponse({
        url: '/internal/stats/',
        body: [],
      });

      const wrapper = render(<AdminQuotas params={{}} />);
      expect(wrapper.container).toSnapshot();
    });
  });
});

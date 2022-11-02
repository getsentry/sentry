import {render} from 'sentry-test/reactTestingLibrary';

import AdminBuffer from 'sentry/views/admin/adminBuffer';

// TODO(dcramer): this doesnt really test anything as we need to
// mock the API Response/wait on it
describe('AdminBuffer', function () {
  describe('render()', function () {
    it('renders', function () {
      MockApiClient.addMockResponse({
        url: '/internal/stats/',
        body: [],
      });

      const wrapper = render(<AdminBuffer params={{}} />);
      expect(wrapper.container).toSnapshot();
    });
  });
});

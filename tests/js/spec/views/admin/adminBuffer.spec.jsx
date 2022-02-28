import {enzymeRender} from 'sentry-test/enzyme';

import AdminBuffer from 'sentry/views/admin/adminBuffer';

// TODO(dcramer): this doesnt really test anything as we need to
// mock the API Response/wait on it
describe('AdminBuffer', function () {
  describe('render()', function () {
    it('renders', function () {
      const wrapper = enzymeRender(<AdminBuffer params={{}} />, {
        context: {
          router: TestStubs.router(),
        },
      });

      expect(wrapper.find('LoadingIndicator')).toHaveLength(2);
      expect(wrapper).toSnapshot();
    });
  });
});

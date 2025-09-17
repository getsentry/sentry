import {render} from 'sentry-test/reactTestingLibrary';

import AdminBuffer from 'sentry/views/admin/adminBuffer';

// TODO(dcramer): this doesnt really test anything as we need to
// mock the API Response/wait on it
describe('AdminBuffer', () => {
  describe('render()', () => {
    it('renders', () => {
      MockApiClient.addMockResponse({
        url: '/internal/stats/',
        body: [],
      });

      render(<AdminBuffer />);
    });
  });
});

import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import {Form} from 'sentry/components/deprecatedforms';

describe('Form', function () {
  describe('render()', function () {
    it('renders with children', function () {
      const {container} = mountWithTheme(
        <Form onSubmit={() => {}}>
          <hr />
        </Form>
      );
      expect(container).toSnapshot();
    });
  });
});

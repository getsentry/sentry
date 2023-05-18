import {render} from 'sentry-test/reactTestingLibrary';

import Form from 'sentry/components/deprecatedforms/form';

describe('Form', function () {
  describe('render()', function () {
    it('renders with children', function () {
      const {container} = render(
        <Form onSubmit={() => {}}>
          <hr />
        </Form>
      );
      expect(container).toSnapshot();
    });
  });
});

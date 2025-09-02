import {render} from 'sentry-test/reactTestingLibrary';

import Form from 'sentry/components/deprecatedforms/form';

describe('Form', () => {
  describe('render()', () => {
    it('renders with children', () => {
      render(
        <Form onSubmit={() => {}}>
          <hr />
        </Form>
      );
    });
  });
});

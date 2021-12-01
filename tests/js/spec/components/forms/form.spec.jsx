import {mountWithTheme} from 'sentry-test/enzyme';

import {Form} from 'sentry/components/forms';

describe('Form', function () {
  describe('render()', function () {
    it('renders with children', function () {
      const wrapper = mountWithTheme(
        <Form onSubmit={() => {}}>
          <hr />
        </Form>
      );
      expect(wrapper).toSnapshot();
    });
  });
});

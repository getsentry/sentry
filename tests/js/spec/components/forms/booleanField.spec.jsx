import {mountWithTheme} from 'sentry-test/enzyme';

import {BooleanField, Form} from 'app/components/forms';

describe('BooleanField', function () {
  describe('render()', function () {
    it('renders without form context', function () {
      const wrapper = mountWithTheme(<BooleanField name="fieldName" />);
      expect(wrapper).toSnapshot();
    });

    it('renders with form context', function () {
      const wrapper = mountWithTheme(
        <Form initialData={{fieldName: true}}>
          <BooleanField name="fieldName" />
        </Form>
      );
      expect(wrapper).toSnapshot();
    });
  });
});

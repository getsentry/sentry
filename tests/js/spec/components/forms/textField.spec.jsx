import {mountWithTheme} from 'sentry-test/enzyme';

import {Form, TextField} from 'app/components/forms';

describe('TextField', function () {
  describe('render()', function () {
    it('renders without form context', function () {
      const wrapper = mountWithTheme(<TextField name="fieldName" />);
      expect(wrapper).toSnapshot();
    });

    it('renders with form context', function () {
      const wrapper = mountWithTheme(
        <Form initialData={{fieldName: 'fieldValue'}}>
          <TextField name="fieldName" />
        </Form>
      );
      expect(wrapper).toSnapshot();
    });
  });
});

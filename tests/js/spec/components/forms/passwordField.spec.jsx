import {mountWithTheme} from 'sentry-test/enzyme';

import {Form, PasswordField} from 'app/components/forms';

describe('PasswordField', function () {
  describe('render()', function () {
    it('renders', function () {
      const wrapper = mountWithTheme(<PasswordField name="fieldName" />);
      expect(wrapper).toSnapshot();
    });

    it('renders with value', function () {
      const wrapper = mountWithTheme(<PasswordField name="fieldName" value="foobar" />);
      expect(wrapper).toSnapshot();
    });

    it('renders with form context', function () {
      const wrapper = mountWithTheme(
        <Form initialData={{fieldName: 'foobar'}}>
          <PasswordField name="fieldName" />
        </Form>
      );
      expect(wrapper).toSnapshot();
    });
  });
});

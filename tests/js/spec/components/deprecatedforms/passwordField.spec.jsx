import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import {Form, PasswordField} from 'sentry/components/deprecatedforms';

describe('PasswordField', function () {
  describe('render()', function () {
    it('renders', function () {
      const {container} = mountWithTheme(<PasswordField name="fieldName" />);
      expect(container).toSnapshot();
    });

    it('renders with value', function () {
      const {container} = mountWithTheme(
        <PasswordField name="fieldName" value="foobar" />
      );
      expect(container).toSnapshot();
    });

    it('renders with form context', function () {
      const {container} = mountWithTheme(
        <Form initialData={{fieldName: 'foobar'}}>
          <PasswordField name="fieldName" />
        </Form>
      );
      expect(container).toSnapshot();
    });
  });
});

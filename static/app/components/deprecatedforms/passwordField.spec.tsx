import {render} from 'sentry-test/reactTestingLibrary';

import Form from 'sentry/components/deprecatedforms/form';
import PasswordField from 'sentry/components/deprecatedforms/passwordField';

describe('PasswordField', function () {
  describe('render()', function () {
    it('renders', function () {
      render(<PasswordField name="fieldName" />);
    });

    it('renders with value', function () {
      render(<PasswordField name="fieldName" value="foobar" />);
    });

    it('renders with form context', function () {
      render(
        <Form initialData={{fieldName: 'foobar'}}>
          <PasswordField name="fieldName" />
        </Form>
      );
    });
  });
});

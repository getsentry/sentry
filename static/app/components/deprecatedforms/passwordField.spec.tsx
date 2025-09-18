import {render} from 'sentry-test/reactTestingLibrary';

import Form from 'sentry/components/deprecatedforms/form';
import PasswordField from 'sentry/components/deprecatedforms/passwordField';

describe('PasswordField', () => {
  describe('render()', () => {
    it('renders', () => {
      render(<PasswordField name="fieldName" />);
    });

    it('renders with value', () => {
      render(<PasswordField name="fieldName" value="foobar" />);
    });

    it('renders with form context', () => {
      render(
        <Form initialData={{fieldName: 'foobar'}}>
          <PasswordField name="fieldName" />
        </Form>
      );
    });
  });
});

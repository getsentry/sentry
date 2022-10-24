import {render} from 'sentry-test/reactTestingLibrary';

import Form from 'sentry/components/deprecatedforms/form';
import PasswordField from 'sentry/components/deprecatedforms/passwordField';

describe('PasswordField', function () {
  describe('render()', function () {
    it('renders', function () {
      const {container} = render(<PasswordField name="fieldName" />);
      expect(container).toSnapshot();
    });

    it('renders with value', function () {
      const {container} = render(<PasswordField name="fieldName" value="foobar" />);
      expect(container).toSnapshot();
    });

    it('renders with form context', function () {
      const {container} = render(
        <Form initialData={{fieldName: 'foobar'}}>
          <PasswordField name="fieldName" />
        </Form>
      );
      expect(container).toSnapshot();
    });
  });
});

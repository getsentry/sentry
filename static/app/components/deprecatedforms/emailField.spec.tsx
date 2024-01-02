import {render} from 'sentry-test/reactTestingLibrary';

import EmailField from 'sentry/components/deprecatedforms/emailField';
import Form from 'sentry/components/deprecatedforms/form';

describe('EmailField', function () {
  describe('render()', function () {
    it('renders', function () {
      render(<EmailField name="fieldName" />);
    });

    it('renders with value', function () {
      render(<EmailField name="fieldName" value="foo@example.com" />);
    });

    it('renders with form context', function () {
      render(
        <Form initialData={{fieldName: 'foo@example.com'}}>
          <EmailField name="fieldName" />
        </Form>
      );
    });
  });
});

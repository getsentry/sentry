import {render} from 'sentry-test/reactTestingLibrary';

import EmailField from 'sentry/components/deprecatedforms/emailField';
import Form from 'sentry/components/deprecatedforms/form';

describe('EmailField', function () {
  describe('render()', function () {
    it('renders', function () {
      const {container} = render(<EmailField name="fieldName" />);
      expect(container).toSnapshot();
    });

    it('renders with value', function () {
      const {container} = render(<EmailField name="fieldName" value="foo@example.com" />);
      expect(container).toSnapshot();
    });

    it('renders with form context', function () {
      const {container} = render(
        <Form initialData={{fieldName: 'foo@example.com'}}>
          <EmailField name="fieldName" />
        </Form>
      );
      expect(container).toSnapshot();
    });
  });
});

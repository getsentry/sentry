import {render} from 'sentry-test/reactTestingLibrary';

import Form from 'sentry/components/deprecatedforms/form';
import TextField from 'sentry/components/deprecatedforms/textField';

describe('TextField', function () {
  describe('render()', function () {
    it('renders without form context', function () {
      render(<TextField name="fieldName" />);
    });

    it('renders with form context', function () {
      render(
        <Form initialData={{fieldName: 'fieldValue'}}>
          <TextField name="fieldName" />
        </Form>
      );
    });
  });
});

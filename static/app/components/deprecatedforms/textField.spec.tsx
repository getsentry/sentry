import {render} from 'sentry-test/reactTestingLibrary';

import Form from 'sentry/components/deprecatedforms/form';
import TextField from 'sentry/components/deprecatedforms/textField';

describe('TextField', () => {
  describe('render()', () => {
    it('renders without form context', () => {
      render(<TextField name="fieldName" />);
    });

    it('renders with form context', () => {
      render(
        <Form initialData={{fieldName: 'fieldValue'}}>
          <TextField name="fieldName" />
        </Form>
      );
    });
  });
});

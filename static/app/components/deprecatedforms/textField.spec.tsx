import {render} from 'sentry-test/reactTestingLibrary';

import Form from 'sentry/components/deprecatedforms/form';
import TextField from 'sentry/components/deprecatedforms/textField';

describe('TextField', function () {
  describe('render()', function () {
    it('renders without form context', function () {
      const {container} = render(<TextField name="fieldName" />);
      expect(container).toSnapshot();
    });

    it('renders with form context', function () {
      const {container} = render(
        <Form initialData={{fieldName: 'fieldValue'}}>
          <TextField name="fieldName" />
        </Form>
      );
      expect(container).toSnapshot();
    });
  });
});

import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import {Form, TextField} from 'sentry/components/deprecatedforms';

describe('TextField', function () {
  describe('render()', function () {
    it('renders without form context', function () {
      const {container} = mountWithTheme(<TextField name="fieldName" />);
      expect(container).toSnapshot();
    });

    it('renders with form context', function () {
      const {container} = mountWithTheme(
        <Form initialData={{fieldName: 'fieldValue'}}>
          <TextField name="fieldName" />
        </Form>
      );
      expect(container).toSnapshot();
    });
  });
});

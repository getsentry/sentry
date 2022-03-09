import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import {EmailField, Form} from 'sentry/components/deprecatedforms';

describe('EmailField', function () {
  describe('render()', function () {
    it('renders', function () {
      const {container} = mountWithTheme(<EmailField name="fieldName" />);
      expect(container).toSnapshot();
    });

    it('renders with value', function () {
      const {container} = mountWithTheme(
        <EmailField name="fieldName" value="foo@example.com" />
      );
      expect(container).toSnapshot();
    });

    it('renders with form context', function () {
      const {container} = mountWithTheme(
        <Form initialData={{fieldName: 'foo@example.com'}}>
          <EmailField name="fieldName" />
        </Form>
      );
      expect(container).toSnapshot();
    });
  });
});

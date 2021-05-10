import {mountWithTheme} from 'sentry-test/enzyme';

import {EmailField} from 'app/components/forms';

describe('EmailField', function () {
  describe('render()', function () {
    it('renders', function () {
      const wrapper = mountWithTheme(<EmailField name="fieldName" />);
      expect(wrapper).toSnapshot();
    });

    it('renders with value', function () {
      const wrapper = mountWithTheme(
        <EmailField name="fieldName" value="foo@example.com" />
      );
      expect(wrapper).toSnapshot();
    });

    it('renders with form context', function () {
      const wrapper = mountWithTheme(<EmailField name="fieldName" />, {
        context: {
          form: {
            data: {
              fieldName: 'foo@example.com',
            },
            errors: {},
          },
        },
      });
      expect(wrapper).toSnapshot();
    });
  });
});

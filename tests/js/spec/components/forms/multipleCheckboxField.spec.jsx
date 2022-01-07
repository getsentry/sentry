import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import {MultipleCheckboxField} from 'sentry/components/forms';

describe('MultipleCheckboxField', function () {
  describe('render()', function () {
    it('renders without form context', function () {
      const {container} = mountWithTheme(
        <MultipleCheckboxField
          name="fieldName"
          choices={[
            ['1', 'On'],
            ['2', 'Off'],
          ]}
          value={['1']}
        />
      );
      expect(container).toSnapshot();
    });

    it('renders with form context', function () {
      const {container} = mountWithTheme(
        <MultipleCheckboxField
          name="fieldName"
          choices={[
            ['1', 'On'],
            ['2', 'Off'],
          ]}
        />,
        {
          context: {
            form: {
              data: {
                fieldName: ['1'],
              },
              errors: {},
            },
          },
        }
      );
      expect(container).toSnapshot();
    });
  });
});

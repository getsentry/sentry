import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import {MultipleCheckboxField} from 'sentry/components/deprecatedforms';
import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';

describe('MultipleCheckboxField', function () {
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
    const model = new FormModel({initialData: {fieldName: ['1']}});
    const {container} = mountWithTheme(
      <Form value={model}>
        <MultipleCheckboxField
          name="fieldName"
          choices={[
            ['1', 'On'],
            ['2', 'Off'],
          ]}
        />
      </Form>
    );
    expect(container).toSnapshot();
    expect(model.fields.get('fieldName')).toEqual(['1']);
  });
});

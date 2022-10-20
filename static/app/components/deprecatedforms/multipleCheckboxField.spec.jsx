import {render} from 'sentry-test/reactTestingLibrary';

import {MultipleCheckboxField} from 'sentry/components/deprecatedforms';

describe('MultipleCheckboxField', function () {
  it('renders without form context', function () {
    const {container} = render(
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
});

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {MultiSelectField} from 'sentry/components/deprecatedforms';
import Form from 'sentry/components/deprecatedforms/form';

describe('MultiSelectField', function () {
  it('renders without form context', function () {
    const wrapper = render(
      <MultiSelectField
        options={[
          {label: 'a', value: 'a'},
          {label: 'b', value: 'b'},
        ]}
        name="fieldName"
      />
    );
    expect(wrapper.container).toSnapshot();
  });

  it('has the right value from props', function () {
    render(
      <form aria-label="Test Form">
        <MultiSelectField
          options={[
            {label: 'a', value: 'a'},
            {label: 'b', value: 'b'},
          ]}
          name="fieldName"
          value={['a']}
        />
      </form>
    );
    expect(screen.getByRole('form')).toHaveFormValues({fieldName: 'a'});
  });

  it('renders with form context', function () {
    render(
      <Form initialData={{fieldName: ['a', 'b']}} aria-label="Multi Form">
        <MultiSelectField
          options={[
            {label: 'a', value: 'a'},
            {label: 'b', value: 'b'},
          ]}
          name="fieldName"
        />
      </Form>
    );

    expect(screen.getByRole('form')).toHaveFormValues({fieldName: ['a', 'b']});
  });
});

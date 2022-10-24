import {render, screen} from 'sentry-test/reactTestingLibrary';

import GenericField from 'sentry/components/deprecatedforms/genericField';
import FormState from 'sentry/components/forms/state';

describe('GenericField', function () {
  it('renders text as TextInput', function () {
    render(
      <GenericField
        formState={FormState.READY}
        formData={{name: 'foo'}}
        onChange={jest.fn()}
        config={{
          name: 'field-name',
          label: 'field label',
          type: 'text',
          placeholder: 'field placeholder',
          help: 'field help',
          required: true,
          choices: [],
          default: '',
          readonly: true,
        }}
      />
    );

    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders text with choices as SelectCreatableField', function () {
    render(
      <GenericField
        formState={FormState.READY}
        formData={{name: 'foo'}}
        onChange={jest.fn()}
        config={{
          name: 'field-name',
          label: 'field label',
          type: 'text',
          placeholder: 'field placeholder',
          help: 'field help',
          required: true,
          choices: [],
          default: '',
          readonly: true,
        }}
      />
    );

    expect(screen.getByRole('textbox')).toHaveAttribute('aria-autocomplete', 'list');
  });
});

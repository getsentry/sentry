import {enzymeRender} from 'sentry-test/enzyme';

import {FormState, GenericField} from 'sentry/components/deprecatedforms';

describe('GenericField', function () {
  it('renders text as TextInput', function () {
    const wrapper = enzymeRender(
      <GenericField
        formState={FormState.READY}
        config={{
          name: 'field-name',
          label: 'field label',
          type: 'text',
        }}
      />
    );
    expect(wrapper.find('TextField')).toHaveLength(1);
  });

  it('renders text with choices as SelectCreatableField', function () {
    const wrapper = enzymeRender(
      <GenericField
        formState={FormState.READY}
        config={{
          name: 'field-name',
          label: 'field label',
          type: 'text',
          choices: [],
        }}
      />
    );
    expect(wrapper.find('SelectCreatableField')).toHaveLength(1);
  });
});

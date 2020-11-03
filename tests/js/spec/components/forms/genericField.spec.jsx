import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import {GenericField, FormState} from 'app/components/forms';

describe('GenericField', function () {
  it('renders text as TextInput', function () {
    const wrapper = shallow(
      <GenericField
        formState={FormState.READY}
        config={{
          name: 'field-name',
          label: 'field label',
          type: 'text',
        }}
      />
    );
    expect(wrapper).toMatchSnapshot();
    expect(wrapper.name()).toEqual('TextField');
  });

  it('renders text with choices as SelectCreatableField', function () {
    const wrapper = shallow(
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
    expect(wrapper).toMatchSnapshot();
    expect(wrapper.name()).toEqual('SelectCreatableField');
  });
});

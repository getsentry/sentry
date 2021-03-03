import React from 'react';
import {action} from '@storybook/addon-actions';

import {Form as LegacyForm} from 'app/components/forms';
import SelectCreatableField from 'app/components/forms/selectCreatableField';
import SelectField from 'app/components/forms/selectField';

export default {
  title: 'Forms/Fields/Old',
};

export const _SelectField = () => (
  <LegacyForm onSubmit={action('onSubmit')}>
    <SelectField
      name="foos"
      choices={[
        ['foo', 'Foo'],
        ['bar', 'Bar'],
        ['baz', 'Baz'],
      ]}
    />
    <SelectField
      name="multi_foos"
      choices={[
        ['foo', 'Foo'],
        ['bar', 'Bar'],
        ['baz', 'Baz'],
      ]}
      multiple
    />
  </LegacyForm>
);

_SelectField.storyName = 'SelectField';

export const _SelectCreatableField = () => (
  <LegacyForm onSubmit={action('onSubmit')}>
    <SelectCreatableField
      label="Creatable"
      name="creatable_foos"
      choices={[
        ['foo', 'Foo'],
        ['bar', 'Bar'],
        ['baz', 'Baz'],
      ]}
    />
    <SelectCreatableField
      label="Creatable (and Multiple)"
      name="creatable_multi_foos"
      multiple
      choices={[
        ['foo', 'Foo'],
        ['bar', 'Bar'],
        ['baz', 'Baz'],
      ]}
    />
  </LegacyForm>
);

_SelectCreatableField.storyName = 'SelectCreatableField';

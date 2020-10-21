import {withInfo} from '@storybook/addon-info';
import {action} from '@storybook/addon-actions';

import {Form as LegacyForm} from 'app/components/forms';
import SelectField from 'app/components/forms/selectField';
import SelectCreatableField from 'app/components/forms/selectCreatableField';

export default {
  title: 'Core/Forms/Fields/Old',
};

export const _SelectField = withInfo({
  text: 'Select Field',
  propTablesExclude: [LegacyForm],
})(() => (
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
));

_SelectField.story = {
  name: 'SelectField',
};

export const _SelectCreatableField = withInfo({
  text: 'Select Creatable Field',
  propTablesExclude: [LegacyForm],
})(() => (
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
));

_SelectCreatableField.story = {
  name: 'SelectCreatableField',
};

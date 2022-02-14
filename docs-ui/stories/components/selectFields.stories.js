import {action} from '@storybook/addon-actions';

import {Form as LegacyForm} from 'sentry/components/deprecatedforms';
import SelectCreatableField from 'sentry/components/deprecatedforms/selectCreatableField';
import SelectField from 'sentry/components/deprecatedforms/selectField';

export default {
  title: 'Deprecated/SelectFields',
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

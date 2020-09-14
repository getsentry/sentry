import React from 'react';
import {withInfo} from '@storybook/addon-info';

import {Form as LegacyForm, PasswordField, BooleanField} from 'app/components/forms';

export default {
  title: 'Forms/Old/Fields',
};

export const _PasswordField = withInfo({
  text: 'Password input',
  propTablesExclude: [LegacyForm],
})(() => (
  <LegacyForm>
    <PasswordField hasSavedValue name="password" label="password" />
  </LegacyForm>
));

_PasswordField.story = {
  name: 'PasswordField',
};

export const _BooleanField = withInfo({
  text: 'Boolean field (i.e. checkbox)',
  propTablesExclude: [LegacyForm],
})(() => (
  <LegacyForm>
    <BooleanField name="field" />
    <BooleanField name="disabled-field" disabled disabledReason="This is off." />
  </LegacyForm>
));

_BooleanField.story = {
  name: 'BooleanField',
};

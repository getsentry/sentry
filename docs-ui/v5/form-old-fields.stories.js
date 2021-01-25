import React from 'react';
import {withInfo} from '@storybook/addon-info';

import {Form as LegacyForm, PasswordField, BooleanField} from 'app/components/forms';

export default {
  title: 'Core/Forms/Old/Fields',
};

export const _PasswordField = withInfo({
  text: 'Password input',
  propTablesExclude: [LegacyForm],
})(() => (
  <LegacyForm>
    <PasswordField hasSavedValue name="password" label="password" />
  </LegacyForm>
));

_PasswordField.storyName = 'PasswordField';

export const _BooleanField = withInfo({
  text: 'Boolean field (i.e. checkbox)',
  propTablesExclude: [LegacyForm],
})(() => (
  <LegacyForm>
    <BooleanField name="field" />
    <BooleanField name="disabled-field" disabled disabledReason="This is off." />
  </LegacyForm>
));

_BooleanField.storyName = 'BooleanField';

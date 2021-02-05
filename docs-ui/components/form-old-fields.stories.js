import React from 'react';

import {BooleanField, Form as LegacyForm, PasswordField} from 'app/components/forms';

export default {
  title: 'Core/Forms/Old/Fields',
};

export const _PasswordField = () => (
  <LegacyForm>
    <PasswordField hasSavedValue name="password" label="password" />
  </LegacyForm>
);

_PasswordField.storyName = 'PasswordField';

export const _BooleanField = () => (
  <LegacyForm>
    <BooleanField name="field" />
    <BooleanField name="disabled-field" disabled disabledReason="This is off." />
  </LegacyForm>
);

_BooleanField.storyName = 'BooleanField';

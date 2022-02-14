import {
  BooleanField,
  Form as LegacyForm,
  PasswordField,
} from 'sentry/components/deprecatedforms';

export default {
  title: 'Deprecated/Fields',
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

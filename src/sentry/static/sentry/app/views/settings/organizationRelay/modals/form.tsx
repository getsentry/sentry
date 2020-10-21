import * as React from 'react';

import {t} from 'app/locale';
import Input from 'app/views/settings/components/forms/controls/input';
import FieldHelp from 'app/views/settings/components/forms/field/fieldHelp';
import Textarea from 'app/views/settings/components/forms/controls/textarea';
import Field from 'app/views/settings/components/forms/field';
import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';
import {Relay} from 'app/types';

type FormField = keyof Pick<Relay, 'name' | 'publicKey' | 'description'>;
type Values = Record<FormField, string>;

type Props = {
  isFormValid: boolean;
  values: Values;
  errors: Partial<Values>;
  disables: Partial<Record<FormField, boolean>>;
  onSave: () => void;
  onValidate: (field: FormField) => () => void;
  onValidateKey: () => void;
  onChange: (field: FormField, value: string) => void;
};

const Form = ({
  values,
  onChange,
  errors,
  onValidate,
  isFormValid,
  disables,
  onValidateKey,
  onSave,
}: Props) => {
  const handleChange = (field: FormField) => (
    event: React.ChangeEvent<HTMLTextAreaElement> | React.ChangeEvent<HTMLInputElement>
  ) => {
    onChange(field, event.target.value);
  };

  const handleSubmit = () => {
    if (isFormValid) {
      onSave();
    }
  };

  // code below copied from src/sentry/static/sentry/app/views/organizationIntegrations/SplitInstallationIdModal.tsx
  // TODO: fix the common method selectText
  const onCopy = (value: string) => async () =>
    //This hack is needed because the normal copying methods with TextCopyInput do not work correctly
    await navigator.clipboard.writeText(value);

  return (
    <form onSubmit={handleSubmit} id="relay-form">
      <Field
        flexibleControlStateSize
        label={t('Display Name')}
        error={errors.name}
        inline={false}
        stacked
        required
      >
        <Input
          type="text"
          name="name"
          placeholder={t('Display Name')}
          onChange={handleChange('name')}
          value={values.name}
          onBlur={onValidate('name')}
          disabled={disables.name}
        />
      </Field>

      {disables.publicKey ? (
        <Field flexibleControlStateSize label={t('Public Key')} inline={false} stacked>
          <TextCopyInput onCopy={onCopy(values.publicKey)}>
            {values.publicKey}
          </TextCopyInput>
        </Field>
      ) : (
        <Field
          label={t('Public Key')}
          error={errors.publicKey}
          flexibleControlStateSize
          inline={false}
          stacked
          required
        >
          <Input
            type="text"
            name="publicKey"
            placeholder={t('Public Key')}
            onChange={handleChange('publicKey')}
            value={values.publicKey}
            onBlur={onValidateKey}
          />
          <FieldHelp>
            {t(
              'Only enter the Public Key value from your credentials file. Never share the Secret key with Sentry or any third party'
            )}
          </FieldHelp>
        </Field>
      )}
      <Field flexibleControlStateSize label={t('Description')} inline={false} stacked>
        <Textarea
          name="description"
          placeholder={t('Description')}
          onChange={handleChange('description')}
          value={values.description}
          disabled={disables.description}
        />
      </Field>
    </form>
  );
};

export default Form;

import * as React from 'react';
import styled from '@emotion/styled';

import Input from 'sentry/components/forms/controls/input';
import Textarea from 'sentry/components/forms/controls/textarea';
import Field from 'sentry/components/forms/field';
import FieldHelp from 'sentry/components/forms/field/fieldHelp';
import TextCopyInput from 'sentry/components/forms/textCopyInput';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Relay} from 'sentry/types';

type FormField = keyof Pick<Relay, 'name' | 'publicKey' | 'description'>;
type Values = Record<FormField, string>;

type Props = {
  disables: Partial<Record<FormField, boolean>>;
  errors: Partial<Values>;
  isFormValid: boolean;
  onChange: (field: FormField, value: string) => void;
  onSave: () => void;
  onValidate: (field: FormField) => () => void;
  onValidateKey: () => void;
  values: Values;
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
  const handleChange =
    (field: FormField) =>
    (
      event: React.ChangeEvent<HTMLTextAreaElement> | React.ChangeEvent<HTMLInputElement>
    ) => {
      onChange(field, event.target.value);
    };

  const handleSubmit = () => {
    if (isFormValid) {
      onSave();
    }
  };

  // code below copied from app/views/organizationIntegrations/SplitInstallationIdModal.tsx
  // TODO: fix the common method selectText
  const onCopy = (value: string) => async () =>
    // This hack is needed because the normal copying methods with TextCopyInput do not work correctly
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
        <FieldWrapper>
          <StyledField
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
          </StyledField>
          <FieldHelp>
            {t(
              'Only enter the Public Key value from your credentials file. Never share the Secret key with Sentry or any third party'
            )}
          </FieldHelp>
        </FieldWrapper>
      )}
      <Field flexibleControlStateSize label={t('Description')} inline={false} stacked>
        <Textarea
          name="description"
          placeholder={t('Description')}
          onChange={handleChange('description')}
          value={values.description}
          disabled={disables.description}
          autosize
        />
      </Field>
    </form>
  );
};

export default Form;

const FieldWrapper = styled('div')`
  padding-bottom: ${space(2)};
`;

const StyledField = styled(Field)`
  padding-bottom: 0;
`;

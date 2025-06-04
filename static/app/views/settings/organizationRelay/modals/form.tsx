import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Input} from 'sentry/components/core/input';
import {TextArea} from 'sentry/components/core/textarea';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import {FieldHelp} from 'sentry/components/forms/fieldGroup/fieldHelp';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Relay} from 'sentry/types/relay';

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

function Form({
  values,
  onChange,
  errors,
  onValidate,
  isFormValid,
  disables,
  onValidateKey,
  onSave,
}: Props) {
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

  const onCopy = (value: string) => () => {
    navigator.clipboard
      .writeText(value)
      .then(() => {
        addSuccessMessage(t('Copied to clipboard'));
      })
      .catch(() => {
        addErrorMessage(t('Error copying to clipboard'));
      });
  };

  return (
    <form onSubmit={handleSubmit} id="relay-form">
      <FieldGroup
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
      </FieldGroup>

      {disables.publicKey ? (
        <FieldGroup
          flexibleControlStateSize
          label={t('Public Key')}
          inline={false}
          stacked
        >
          <TextCopyInput onCopy={onCopy(values.publicKey)}>
            {values.publicKey}
          </TextCopyInput>
        </FieldGroup>
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
      <FieldGroup
        flexibleControlStateSize
        label={t('Description')}
        inline={false}
        stacked
      >
        <TextArea
          name="description"
          placeholder={t('Description')}
          onChange={handleChange('description')}
          value={values.description}
          disabled={disables.description}
          autosize
        />
      </FieldGroup>
    </form>
  );
}

export default Form;

const FieldWrapper = styled('div')`
  padding-bottom: ${space(2)};
`;

const StyledField = styled(FieldGroup)`
  padding-bottom: 0;
`;

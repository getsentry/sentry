import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import QuestionTooltip from 'app/components/questionTooltip';
import Input from 'app/views/settings/components/forms/controls/input';
import Textarea from 'app/views/settings/components/forms/controls/textarea';
import Field from 'app/views/settings/components/forms/field';
import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';
import space from 'app/styles/space';
import {Relay} from 'app/types';

type FormField = keyof Pick<Relay, 'name' | 'publicKey' | 'description'>;
type Values = Record<FormField, string>;

type Props = {
  values: Values;
  errors: Partial<Values>;
  disables: Partial<Record<FormField, boolean>>;
  onValidate: (field: FormField) => () => void;
  onValidateKey: () => void;
  onChange: (field: FormField, value: string) => void;
};

const Form = ({values, onChange, errors, onValidate, disables, onValidateKey}: Props) => {
  const handleChange = (field: FormField) => (
    event: React.ChangeEvent<HTMLTextAreaElement> | React.ChangeEvent<HTMLInputElement>
  ) => {
    onChange(field, event.target.value);
  };

  // code below copied from src/sentry/static/sentry/app/views/organizationIntegrations/SplitInstallationIdModal.tsx
  // TODO: fix the common method selectText
  const onCopy = (value: string) => async () =>
    //This hack is needed because the normal copying methods with TextCopyInput do not work correctly
    await navigator.clipboard.writeText(value);

  return (
    <React.Fragment>
      <Field
        flexibleControlStateSize
        label={t('Display Name')}
        error={errors.name}
        inline={false}
        stacked
      >
        <Input
          type="text"
          name="name"
          onChange={handleChange('name')}
          value={values.name}
          onBlur={onValidate('name')}
          disabled={disables.name}
        />
      </Field>

      {disables.publicKey ? (
        <Field flexibleControlStateSize label={t('Relay Key')} inline={false} stacked>
          <TextCopyInput onCopy={onCopy(values.publicKey)}>
            {values.publicKey}
          </TextCopyInput>
        </Field>
      ) : (
        <Field
          flexibleControlStateSize
          label={
            <Label>
              <div>{t('Relay Key')}</div>
              <QuestionTooltip
                position="top"
                size="sm"
                title={t(
                  'Only enter the Relay Key value from your credentials file. Never share the Secret key with Sentry or any third party'
                )}
              />
            </Label>
          }
          error={errors.publicKey}
          inline={false}
          stacked
        >
          <Input
            type="text"
            name="publicKey"
            onChange={handleChange('publicKey')}
            value={values.publicKey}
            onBlur={onValidateKey}
          />
        </Field>
      )}
      <Field
        flexibleControlStateSize
        label={t('Description (Optional)')}
        inline={false}
        stacked
      >
        <Textarea
          name="description"
          onChange={handleChange('description')}
          value={values.description}
          disabled={disables.description}
        />
      </Field>
    </React.Fragment>
  );
};

export default Form;

const Label = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
  grid-template-columns: max-content max-content;
  align-items: center;
`;

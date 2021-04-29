import React from 'react';

import {t} from 'app/locale';
import Input from 'app/views/settings/components/forms/controls/input';
import Textarea from 'app/views/settings/components/forms/controls/textarea';
import Field from 'app/views/settings/components/forms/field';

import StepContent from './stepContent';
import {StepOneData} from './types';

type Props = {
  data: StepOneData;
  onChange: (data: StepOneData) => void;
};

function StepOne({onChange, data}: Props) {
  return (
    <StepContent>
      <Field label={t('Issuer')} inline={false} flexibleControlStateSize stacked required>
        <Input
          type="text"
          name="issuer"
          placeholder={t('Issuer')}
          value={data.issuer}
          onChange={e =>
            onChange({
              ...data,
              issuer: e.target.value,
            })
          }
        />
      </Field>
      <Field label={t('Key ID')} inline={false} flexibleControlStateSize stacked required>
        <Input
          type="text"
          name="keyId"
          placeholder={t('Key Id')}
          value={data.keyId}
          onChange={e =>
            onChange({
              ...data,
              keyId: e.target.value,
            })
          }
        />
      </Field>
      <Field
        label={t('Private Key')}
        inline={false}
        flexibleControlStateSize
        stacked
        required
      >
        <Textarea
          name="privateKey"
          placeholder={t('Private Key')}
          value={data.privateKey}
          rows={5}
          maxRows={5}
          autosize
          onChange={e =>
            onChange({
              ...data,
              privateKey: e.target.value,
            })
          }
        />
      </Field>
    </StepContent>
  );
}

export default StepOne;

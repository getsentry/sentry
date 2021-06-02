import {Fragment} from 'react';

import {t} from 'app/locale';
import Input from 'app/views/settings/components/forms/controls/input';
import Textarea from 'app/views/settings/components/forms/controls/textarea';
import Field from 'app/views/settings/components/forms/field';

import {StepOneData} from './types';

type Props = {
  stepOneData: StepOneData;
  onSetStepOneData: (stepOneData: StepOneData) => void;
};

function StepOne({stepOneData, onSetStepOneData}: Props) {
  return (
    <Fragment>
      <Field label={t('Issuer')} inline={false} flexibleControlStateSize stacked required>
        <Input
          type="text"
          name="issuer"
          placeholder={t('Issuer')}
          value={stepOneData.issuer}
          onChange={e =>
            onSetStepOneData({
              ...stepOneData,
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
          value={stepOneData.keyId}
          onChange={e =>
            onSetStepOneData({
              ...stepOneData,
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
          value={stepOneData.privateKey}
          rows={5}
          maxRows={5}
          autosize
          onChange={e =>
            onSetStepOneData({
              ...stepOneData,
              privateKey: e.target.value,
            })
          }
        />
      </Field>
    </Fragment>
  );
}

export default StepOne;

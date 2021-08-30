import {Fragment} from 'react';

import {t} from 'app/locale';
import Input from 'app/views/settings/components/forms/controls/input';
import Field from 'app/views/settings/components/forms/field';

import {StepThreeData} from './types';

type Props = {
  stepThreeData: StepThreeData;
  onSetStepOneData: (stepThreeData: StepThreeData) => void;
};

function StepThree({stepThreeData, onSetStepOneData}: Props) {
  return (
    <Fragment>
      <Field
        label={t('Username')}
        inline={false}
        flexibleControlStateSize
        stacked
        required
      >
        <Input
          type="text"
          name="username"
          placeholder={t('Username')}
          value={stepThreeData.username}
          onChange={e => onSetStepOneData({...stepThreeData, username: e.target.value})}
        />
      </Field>
      <Field
        label={t('Password')}
        inline={false}
        flexibleControlStateSize
        stacked
        required
      >
        <Input
          name="password"
          type={stepThreeData.password === undefined ? 'text' : 'password'}
          value={stepThreeData.password}
          placeholder={
            stepThreeData.password === undefined
              ? t('(Password unchanged)')
              : t('Password')
          }
          onChange={e =>
            onSetStepOneData({
              ...stepThreeData,
              password: e.target.value,
            })
          }
        />
      </Field>
    </Fragment>
  );
}

export default StepThree;

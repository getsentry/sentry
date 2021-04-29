import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import {t} from 'app/locale';
import space from 'app/styles/space';
import Input from 'app/views/settings/components/forms/controls/input';
import Field from 'app/views/settings/components/forms/field';

import StepContent from './stepContent';
import {StepThreeData} from './types';

type Props = {
  data: StepThreeData;
  useSms: boolean;
  onChange: (data: StepThreeData) => void;
  onSendCodeViaSms: () => void;
};

function StepThree({data, useSms, onChange, onSendCodeViaSms}: Props) {
  return (
    <StepContent>
      <StyledField
        label={t('Two Factor authentication code')}
        inline={false}
        flexibleControlStateSize
        stacked
        required
      >
        <Input
          type="text"
          name="two-factor-authentication-code"
          placeholder={t('Enter your code')}
          value={data.itunesAuthenticationCode}
          onChange={e =>
            onChange({
              ...data,
              itunesAuthenticationCode: e.target.value,
            })
          }
        />
      </StyledField>
      <Button priority="link" onClick={onSendCodeViaSms}>
        {useSms ? t('Resend sms code') : t('Send code via sms')}
      </Button>
    </StepContent>
  );
}

export default StepThree;

const StyledField = styled(Field)`
  padding-bottom: ${space(1)};
`;

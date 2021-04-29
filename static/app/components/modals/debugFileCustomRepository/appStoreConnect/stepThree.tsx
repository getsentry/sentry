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
  isActive: boolean;
};

function StepThree({data, useSms, onChange, onSendCodeViaSms, isActive}: Props) {
  return (
    <React.Fragment>
      {useSms
        ? t('Enter the code you have received via Sms')
        : t('Enter your iTunes authentication code')}
      {isActive && (
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
      )}
    </React.Fragment>
  );
}

export default StepThree;

const StyledField = styled(Field)`
  padding-bottom: ${space(1)};
`;

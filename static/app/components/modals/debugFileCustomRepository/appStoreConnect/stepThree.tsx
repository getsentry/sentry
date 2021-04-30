import React from 'react';
import styled from '@emotion/styled';

import Alert from 'app/components/alert';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {IconInfo, IconMobile, IconRefresh} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import Input from 'app/views/settings/components/forms/controls/input';
import Field from 'app/views/settings/components/forms/field';

import StepContent from './stepContent';
import {StepThreeData} from './types';

type Props = {
  data: StepThreeData;
  onChange: (data: StepThreeData) => void;
  onSendCodeViaSms: () => void;
  onSendVerificationCode: () => void;
};

function StepThree({data, onChange, onSendVerificationCode, onSendCodeViaSms}: Props) {
  return (
    <StepContent>
      <Alert type="info">
        <AlertContent>
          <IconInfo />
          {t('Did not get a verification code?')}
          <ButtonBar gap={1}>
            <Button
              size="small"
              title={t('Get a new verification code')}
              onClick={onSendVerificationCode}
              icon={<IconRefresh />}
            >
              {t('Resend code')}
            </Button>
            <Button
              size="small"
              title={t('Get a text message with a code')}
              onClick={onSendCodeViaSms}
              icon={<IconMobile />}
            >
              {t('Text me')}
            </Button>
          </ButtonBar>
        </AlertContent>
      </Alert>
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
    </StepContent>
  );
}

export default StepThree;

const StyledField = styled(Field)`
  padding-bottom: ${space(1)};
`;

const AlertContent = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  align-items: center;
  grid-gap: ${space(1)};
`;

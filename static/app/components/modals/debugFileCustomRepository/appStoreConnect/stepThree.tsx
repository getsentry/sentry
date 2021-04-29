import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import {t} from 'app/locale';
import space from 'app/styles/space';
import Input from 'app/views/settings/components/forms/controls/input';
import Field from 'app/views/settings/components/forms/field';

import {StepThreeData} from './types';

type Props = {
  data: StepThreeData;
  useSms: boolean;
  onChange: (data: StepThreeData) => void;
  onSendCodeViaSms: () => void;
};

function StepThree({data, useSms, onChange, onSendCodeViaSms}: Props) {
  return (
    <StyledList symbol="colored-numeric" initialCounterValue={2}>
      <ListItem>
        {useSms
          ? t('Enter the code you have received via Sms')
          : t('Enter your iTunes authentication code')}
        <ListItemContent>
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
        </ListItemContent>
      </ListItem>
    </StyledList>
  );
}

export default StepThree;

const StyledList = styled(List)`
  grid-gap: ${space(2)};
`;

const ListItemContent = styled('div')`
  padding-top: ${space(2)};
`;

const StyledField = styled(Field)`
  padding-bottom: ${space(1)};
`;

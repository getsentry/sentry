import React from 'react';
import styled from '@emotion/styled';

import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import {t} from 'app/locale';
import space from 'app/styles/space';
import Input from 'app/views/settings/components/forms/controls/input';
import Field from 'app/views/settings/components/forms/field';

import {StepTwoData} from './types';

type Props = {
  data: StepTwoData;
  onChange: (data: StepTwoData) => void;
};

function StepTwo({onChange, data}: Props) {
  return (
    <StyledList symbol="colored-numeric" initialCounterValue={1}>
      <ListItem>
        {t('Enter your itunes credentials')}
        <ListItemContent>
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
              onChange={e => onChange({...data, username: e.target.value})}
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
              type="password"
              name="password"
              placeholder={t('Password')}
              onChange={e => onChange({...data, password: e.target.value})}
            />
          </Field>
        </ListItemContent>
      </ListItem>
    </StyledList>
  );
}

export default StepTwo;

const StyledList = styled(List)`
  grid-gap: ${space(2)};
`;

const ListItemContent = styled('div')`
  padding-top: ${space(2)};
`;

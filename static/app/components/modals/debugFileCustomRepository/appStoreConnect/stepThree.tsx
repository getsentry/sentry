import React from 'react';
import styled from '@emotion/styled';

import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import {t} from 'app/locale';
import space from 'app/styles/space';
import Input from 'app/views/settings/components/forms/controls/input';
import Field from 'app/views/settings/components/forms/field';
import SelectField from 'app/views/settings/components/forms/selectField';

import {App, StepThreeData} from './types';

type Props = {
  apps: App[];
  data: StepThreeData;
  onChange: (data: StepThreeData) => void;
};

function StepThree({apps, onChange, data}: Props) {
  return (
    <StyledList symbol="colored-numeric" initialCounterValue={2}>
      <ListItem>
        {t('Enter your iTunes authentication code')}
        <ListItemContent>
          <Field
            label={t('iTunes authentication code')}
            inline={false}
            flexibleControlStateSize
            stacked
            required
          >
            <Input
              type="text"
              name="itunes-authentication-code"
              placeholder={t('iTunes authentication code')}
              value={data.issuer}
              onChange={e =>
                onChange({
                  ...data,
                  issuer: e.target.value,
                })
              }
            />
          </Field>
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

const StyledSelectField = styled(SelectField)`
  padding-right: 0;
`;

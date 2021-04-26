import React from 'react';
import styled from '@emotion/styled';

import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import {t} from 'app/locale';
import space from 'app/styles/space';
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
        {t('Choose your app')}
        <ListItemContent>
          <StyledSelectField
            name="app"
            choices={apps.map(app => [app.appId, app.name])}
            placeholder={t('Select app')}
            onChange={appId => {
              const selectedApp = apps.find(app => app.appId === appId);
              onChange({...data, app: selectedApp});
            }}
            value={data.app?.appId ?? ''}
            inline={false}
            flexibleControlStateSize
            stacked
          />
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

import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import SelectField from 'app/views/settings/components/forms/selectField';

import StepContent from './stepContent';
import {App, AppleStoreOrg, StepFourData} from './types';

type Props = {
  orgs: AppleStoreOrg[];
  apps: App[];
  data: StepFourData;
  onChange: (data: StepFourData) => void;
};

function StepFour({apps, onChange, data, orgs}: Props) {
  return (
    <StepContent>
      <StyledSelectField
        name="organization"
        label={t('Organization')}
        choices={orgs.map(org => [org.organizationId, org.name])}
        placeholder={t('Select organization')}
        onChange={organizationId => {
          const selectedOrganization = orgs.find(
            org => org.organizationId === organizationId
          );
          onChange({...data, org: selectedOrganization});
        }}
        value={data.org?.organizationId ?? ''}
        inline={false}
        flexibleControlStateSize
        stacked
        required
      />
      <StyledSelectField
        name="app"
        label={t('Application')}
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
        required
      />
    </StepContent>
  );
}

export default StepFour;

const StyledSelectField = styled(SelectField)`
  padding-right: 0;
`;

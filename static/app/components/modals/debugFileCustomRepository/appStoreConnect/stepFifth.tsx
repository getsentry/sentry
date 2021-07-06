import styled from '@emotion/styled';

import {t} from 'app/locale';
import SelectField from 'app/views/settings/components/forms/selectField';

import {AppleStoreOrg, StepFifthData} from './types';

type Props = {
  appleStoreOrgs: AppleStoreOrg[];
  stepFifthData: StepFifthData;
  onSetStepFifthData: (stepFifthData: StepFifthData) => void;
};

function StepFifth({appleStoreOrgs, stepFifthData, onSetStepFifthData}: Props) {
  return (
    <StyledSelectField
      name="organization"
      label={t('iTunes Organization')}
      choices={appleStoreOrgs.map(appleStoreOrg => [
        appleStoreOrg.organizationId,
        appleStoreOrg.name,
      ])}
      placeholder={t('Select organization')}
      onChange={organizationId => {
        const selectedAppleStoreOrg = appleStoreOrgs.find(
          appleStoreOrg => appleStoreOrg.organizationId === organizationId
        );
        onSetStepFifthData({org: selectedAppleStoreOrg});
      }}
      value={stepFifthData.org?.organizationId ?? ''}
      inline={false}
      flexibleControlStateSize
      stacked
      required
    />
  );
}

export default StepFifth;

const StyledSelectField = styled(SelectField)`
  padding-right: 0;
`;

import styled from '@emotion/styled';

import {t} from 'app/locale';
import SelectField from 'app/views/settings/components/forms/selectField';

import {AppStoreApp, StepTwoData} from './types';

type Props = {
  appStoreApps: AppStoreApp[];
  stepTwoData: StepTwoData;
  onSetStepTwoData: (stepTwoData: StepTwoData) => void;
};

function StepTwo({stepTwoData, onSetStepTwoData, appStoreApps}: Props) {
  return (
    <StyledSelectField
      name="application"
      label={t('App Store Connect application')}
      choices={appStoreApps.map(appStoreApp => [appStoreApp.appId, appStoreApp.name])}
      placeholder={t('Select application')}
      onChange={appId => {
        const selectedAppStoreApp = appStoreApps.find(
          appStoreApp => appStoreApp.appId === appId
        );
        onSetStepTwoData({app: selectedAppStoreApp});
      }}
      value={stepTwoData.app?.appId ?? ''}
      inline={false}
      flexibleControlStateSize
      stacked
      required
    />
  );
}

export default StepTwo;

const StyledSelectField = styled(SelectField)`
  padding-right: 0;
`;

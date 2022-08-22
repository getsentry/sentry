import styled from '@emotion/styled';

import SelectField from 'sentry/components/forms/selectField';
import {t} from 'sentry/locale';

import {AppStoreApp, StepTwoData} from './types';

type Props = {
  appStoreApps: AppStoreApp[];
  onSetStepTwoData: (stepTwoData: StepTwoData) => void;
  stepTwoData: StepTwoData;
};

function StepTwo({stepTwoData, onSetStepTwoData, appStoreApps}: Props) {
  return (
    <StyledSelectField
      name="application"
      label={t('App Store Connect application')}
      options={appStoreApps.map(appStoreApp => ({
        value: appStoreApp.appId,
        label: appStoreApp.name,
      }))}
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

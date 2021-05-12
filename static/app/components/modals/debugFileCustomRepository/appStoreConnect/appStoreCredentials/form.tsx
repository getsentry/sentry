import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import Input from 'app/views/settings/components/forms/controls/input';
import Textarea from 'app/views/settings/components/forms/controls/textarea';
import Field from 'app/views/settings/components/forms/field';
import SelectField from 'app/views/settings/components/forms/selectField';

import Stepper from '../stepper';
import StepActions from '../stepper/stepActions';
import {
  App,
  AppStoreCredentialsData,
  AppStoreCredentialsStepOneData,
  AppStoreCredentialsStepTwoData,
} from '../types';

const steps = [t('Enter your credentials'), t('Choose an application')];

type Props = {
  api: Client;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
  data: AppStoreCredentialsData;
  onChange: (data: AppStoreCredentialsData) => void;
  onSwitchToReadMode: () => void;
  onCancel?: () => void;
};

function Form({
  api,
  orgSlug,
  projectSlug,
  data,
  onChange,
  onCancel,
  onSwitchToReadMode,
}: Props) {
  const [activeStep, setActiveStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const [appStoreApps, setAppStoreApps] = useState<App[]>([]);

  const [stepOneData, setStepOneData] = useState<AppStoreCredentialsStepOneData>({
    issuer: data.issuer,
    keyId: data.keyId,
    privateKey: data.privateKey,
  });

  const [stepTwoData, setStepTwoData] = useState<AppStoreCredentialsStepTwoData>({
    app: data.app,
  });

  function isFormInvalid() {
    switch (activeStep) {
      case 0:
        return Object.keys(stepOneData).some(key => !stepOneData[key]);
      case 1:
        return Object.keys(stepTwoData).some(key => !stepTwoData[key]);
      default:
        return false;
    }
  }

  function goNext() {
    setActiveStep(prevActiveStep => prevActiveStep + 1);
  }

  function handleGoBack() {
    setActiveStep(prevActiveStep => prevActiveStep - 1);
  }

  function handleGoNext() {
    checkAppStoreConnectCredentials();
  }

  function handleSave() {
    const updatedData = {
      ...stepOneData,
      ...stepTwoData,
    };

    onChange(updatedData);
    onSwitchToReadMode();
  }

  async function checkAppStoreConnectCredentials() {
    setIsLoading(true);
    try {
      const response = await api.requestPromise(
        `/projects/${orgSlug}/${projectSlug}/appstoreconnect/apps/`,
        {
          method: 'POST',
          data: {
            appconnectIssuer: stepOneData.issuer,
            appconnectKey: stepOneData.keyId,
            appconnectPrivateKey: stepOneData.privateKey,
          },
        }
      );

      setAppStoreApps(response.apps);
      setStepTwoData({app: response.apps[0]});
      setIsLoading(false);
      goNext();
    } catch {
      setIsLoading(false);
      addErrorMessage(
        t(
          'We could not establish a connection with App Store Connect. Please check the entered App Store Connect credentials.'
        )
      );
    }
  }

  function renderStepContent(stepIndex: number) {
    switch (stepIndex) {
      case 0:
        return (
          <Fragment>
            <Field
              label={t('Issuer')}
              inline={false}
              flexibleControlStateSize
              stacked
              required
            >
              <Input
                type="text"
                name="issuer"
                placeholder={t('Issuer')}
                value={stepOneData.issuer}
                onChange={e =>
                  setStepOneData({
                    ...stepOneData,
                    issuer: e.target.value,
                  })
                }
              />
            </Field>
            <Field
              label={t('Key ID')}
              inline={false}
              flexibleControlStateSize
              stacked
              required
            >
              <Input
                type="text"
                name="keyId"
                placeholder={t('Key Id')}
                value={stepOneData.keyId}
                onChange={e =>
                  setStepOneData({
                    ...stepOneData,
                    keyId: e.target.value,
                  })
                }
              />
            </Field>
            <Field
              label={t('Private Key')}
              inline={false}
              flexibleControlStateSize
              stacked
              required
            >
              <Textarea
                name="privateKey"
                placeholder={t('Private Key')}
                value={stepOneData.privateKey}
                rows={5}
                maxRows={5}
                autosize
                onChange={e =>
                  setStepOneData({
                    ...stepOneData,
                    privateKey: e.target.value,
                  })
                }
              />
            </Field>
          </Fragment>
        );
      case 1:
        return (
          <StyledSelectField
            name="application"
            label={t('App Store Connect Application')}
            choices={appStoreApps.map(appStoreApp => [
              appStoreApp.appId,
              appStoreApp.name,
            ])}
            placeholder={t('Select application')}
            onChange={appId => {
              const selectedAppStoreApp = appStoreApps.find(
                appStoreApp => appStoreApp.appId === appId
              );
              setStepTwoData({app: selectedAppStoreApp});
            }}
            value={stepTwoData.app?.appId ?? ''}
            inline={false}
            flexibleControlStateSize
            stacked
            required
          />
        );
      default:
        return (
          <Alert type="error" icon={<IconWarning />}>
            {t('This step could not be found.')}
          </Alert>
        );
    }
  }

  return (
    <Stepper
      activeStep={activeStep}
      steps={steps}
      renderStepContent={index => renderStepContent(index)}
      renderStepActions={index => (
        <StepActions
          onGoBack={index !== 0 ? handleGoBack : undefined}
          onGoNext={index !== steps.length - 1 ? handleGoNext : undefined}
          onCancel={onCancel}
          onFinish={handleSave}
          primaryButtonDisabled={isFormInvalid() || isLoading}
          isLoading={isLoading}
        />
      )}
    />
  );
}

export default Form;

const StyledSelectField = styled(SelectField)`
  padding-right: 0;
`;

import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {IconInfo, IconMobile, IconRefresh, IconWarning} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import Input from 'app/views/settings/components/forms/controls/input';
import Field from 'app/views/settings/components/forms/field';
import SelectField from 'app/views/settings/components/forms/selectField';

import Stepper from '../stepper';
import StepActions from '../stepper/stepActions';
import {
  AppleStoreOrg,
  ItunesCredentialsData,
  ItunesCredentialsStepOneData,
  ItunesCredentialsStepThreeData,
  ItunesCredentialsStepTwoData,
} from '../types';

const steps = [
  t('Enter your credentials'),
  t('Enter your authentication code'),
  t('Choose an organization'),
];

type Props = {
  api: Client;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
  data: ItunesCredentialsData;
  revalidateItunesSession: boolean;
  onChange: (data: ItunesCredentialsData) => void;
  onSwitchToReadMode: () => void;
  onCancel?: () => void;
};

function Form({
  api,
  orgSlug,
  projectSlug,
  data,
  revalidateItunesSession,
  onChange,
  onSwitchToReadMode,
  onCancel,
}: Props) {
  const [activeStep, setActiveStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionContext, setSessionContext] = useState('');
  const [useSms, setUseSms] = useState(false);
  const [appStoreOrgs, setAppStoreOrgs] = useState<AppleStoreOrg[]>([]);

  const [stepOneData, setSetpOneData] = useState<ItunesCredentialsStepOneData>({
    username: data.username,
    password: data.password,
  });

  const [stepTwoData, setStepTwoData] = useState<ItunesCredentialsStepTwoData>({
    authenticationCode: data.authenticationCode,
  });

  const [stepThreeData, setStepThreeData] = useState<ItunesCredentialsStepThreeData>({
    org: data.org,
  });

  useEffect(() => {
    if (revalidateItunesSession) {
      handleGoNext();
    }
  }, [revalidateItunesSession]);

  function isFormInvalid() {
    switch (activeStep) {
      case 0:
        return Object.keys(stepOneData).some(key => !stepOneData[key]);
      case 1:
        return Object.keys(stepTwoData).some(key => !stepTwoData[key]);
      case 2:
        return Object.keys(stepThreeData).some(key => !stepThreeData[key]);
      default:
        return false;
    }
  }

  function goNext() {
    setActiveStep(prevActiveStep => prevActiveStep + 1);
  }

  function handleGoBack() {
    const newActiveStep = activeStep - 1;

    switch (newActiveStep) {
      case 1:
        startItunesAuthentication(false);
        setStepTwoData({authenticationCode: undefined});
        break;
      default:
        break;
    }

    setActiveStep(newActiveStep);
  }

  function handleGoNext() {
    switch (activeStep) {
      case 0:
        startItunesAuthentication();
        break;
      case 1:
        startTwoFactorAuthentication();
        break;
      default:
        break;
    }
  }

  function handleSave() {
    onChange({...stepOneData, ...stepTwoData, ...stepThreeData, sessionContext, useSms});
    onSwitchToReadMode();
  }

  async function startItunesAuthentication(shouldGoNext = true) {
    if (shouldGoNext) {
      setIsLoading(true);
    }
    if (useSms) {
      setUseSms(false);
    }

    try {
      const response = await api.requestPromise(
        `/projects/${orgSlug}/${projectSlug}/appstoreconnect/start/`,
        {
          method: 'POST',
          data: {
            itunesUser: stepOneData.username,
            itunesPassword: stepOneData.password,
          },
        }
      );

      setSessionContext(response.sessionContext);

      if (shouldGoNext) {
        setIsLoading(false);
        goNext();
      }
    } catch {
      if (shouldGoNext) {
        setIsLoading(false);
      }
      addErrorMessage(
        t('The iTunes authentication failed. Please check the entered credentials.')
      );
    }
  }

  async function startTwoFactorAuthentication() {
    setIsLoading(true);
    try {
      const response = await api.requestPromise(
        `/projects/${orgSlug}/${projectSlug}/appstoreconnect/2fa/`,
        {
          method: 'POST',
          data: {
            code: stepTwoData.authenticationCode,
            useSms,
            sessionContext,
          },
        }
      );
      setIsLoading(false);
      const {organizations, sessionContext: newSessionContext} = response;
      setStepThreeData({org: organizations[0]});
      setAppStoreOrgs(organizations);
      setSessionContext(newSessionContext);
      goNext();
    } catch {
      setIsLoading(false);
      addErrorMessage(
        t('The two factor authentication failed. Please check the entered code.')
      );
    }
  }

  async function startSmsAuthentication() {
    if (!useSms) {
      setUseSms(true);
    }

    try {
      const response = await api.requestPromise(
        `/projects/${orgSlug}/${projectSlug}/appstoreconnect/requestSms/`,
        {
          method: 'POST',
          data: {sessionContext},
        }
      );

      setSessionContext(response.sessionContext);
    } catch {
      addErrorMessage(t('An error occured while sending the SMS. Please try again'));
    }
  }

  function renderStepContent(stepIndex: number) {
    switch (stepIndex) {
      case 0:
        return (
          <Fragment>
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
                onChange={e => setSetpOneData({...stepOneData, username: e.target.value})}
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
                onChange={e => setSetpOneData({...stepOneData, password: e.target.value})}
              />
            </Field>
          </Fragment>
        );
      case 1:
        return (
          <Fragment>
            <StyledAlert type="info" icon={<IconInfo />}>
              <AlertContent>
                {t('Did not get a verification code?')}
                <ButtonBar gap={1}>
                  <Button
                    size="small"
                    title={t('Get a new verification code')}
                    onClick={() => startItunesAuthentication(false)}
                    icon={<IconRefresh />}
                  >
                    {t('Resend code')}
                  </Button>
                  <Button
                    size="small"
                    title={t('Get a text message with a code')}
                    onClick={() => startSmsAuthentication()}
                    icon={<IconMobile />}
                  >
                    {t('Text me')}
                  </Button>
                </ButtonBar>
              </AlertContent>
            </StyledAlert>
            <Field
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
                value={stepTwoData.authenticationCode}
                onChange={e =>
                  setStepTwoData({
                    ...setStepTwoData,
                    authenticationCode: e.target.value,
                  })
                }
              />
            </Field>
          </Fragment>
        );
      case 2:
        return (
          <StyledSelectField
            name="organization"
            label={t('iTunes Organization')}
            choices={appStoreOrgs.map(appStoreOrg => [
              appStoreOrg.organizationId,
              appStoreOrg.name,
            ])}
            placeholder={t('Select organization')}
            onChange={organizationId => {
              const selectedAppStoreOrg = appStoreOrgs.find(
                appStoreOrg => appStoreOrg.organizationId === organizationId
              );
              setStepThreeData({org: selectedAppStoreOrg});
            }}
            value={stepThreeData.org?.organizationId ?? ''}
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

const StyledAlert = styled(Alert)`
  display: grid;
  grid-template-columns: max-content 1fr;
  align-items: center;
  span:nth-child(2) {
    margin: 0;
  }
`;

const AlertContent = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  align-items: center;
  grid-gap: ${space(2)};
`;

const StyledSelectField = styled(SelectField)`
  padding-right: 0;
`;

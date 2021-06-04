import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import LoadingIndicator from 'app/components/loadingIndicator';
import {AppStoreConnectContextProps} from 'app/components/projects/appStoreConnectContext';
import {IconInfo, IconWarning} from 'app/icons';
import {t, tct} from 'app/locale';
import space, {ValidSize} from 'app/styles/space';
import {Organization, Project} from 'app/types';
import withApi from 'app/utils/withApi';

import StepFifth from './stepFifth';
import StepFour from './stepFour';
import StepOne from './stepOne';
import StepThree from './stepThree';
import StepTwo from './stepTwo';
import {
  AppleStoreOrg,
  AppStoreApp,
  StepFifthData,
  StepFourData,
  StepOneData,
  StepThreeData,
  StepTwoData,
} from './types';

type InitialData = {
  appId: string;
  appName: string;
  appconnectIssuer: string;
  appconnectKey: string;
  appconnectPrivateKey: string;
  encrypted: string;
  id: string;
  itunesPassword: string;
  itunesUser: string;
  name: string;
  orgId: number;
  orgName: string;
  refreshDate: string;
  type: string;
  error?: string;
};

type Props = Pick<ModalRenderProps, 'Header' | 'Body' | 'Footer' | 'closeModal'> & {
  api: Client;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
  onSubmit: (data: Record<string, any>) => void;
  revalidateItunesSession: boolean;
  appStoreConnectContext?: AppStoreConnectContextProps;
  initialData?: InitialData;
};

const steps = [
  t('App Store Connect credentials'),
  t('Choose an application'),
  t('Enter iTunes credentials'),
  t('Enter authentication code'),
  t('Choose an organization'),
];

function AppStoreConnect({
  Header,
  Body,
  Footer,
  closeModal,
  api,
  initialData,
  orgSlug,
  projectSlug,
  onSubmit,
  revalidateItunesSession,
  appStoreConnectContext,
}: Props) {
  const shouldRevalidateItunesSession =
    revalidateItunesSession &&
    (appStoreConnectContext?.itunesSessionValid === false ||
      appStoreConnectContext?.appstoreCredentialsValid === false);

  const [isLoading, setIsLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(shouldRevalidateItunesSession ? 2 : 0);
  const [appStoreApps, setAppStoreApps] = useState<AppStoreApp[]>([]);
  const [appleStoreOrgs, setAppleStoreOrgs] = useState<AppleStoreOrg[]>([]);
  const [useSms, setUseSms] = useState(false);
  const [sessionContext, setSessionContext] = useState('');

  const [stepOneData, setStepOneData] = useState<StepOneData>({
    issuer: initialData?.appconnectIssuer,
    keyId: initialData?.appconnectKey,
    privateKey: initialData?.appconnectPrivateKey,
  });

  const [stepTwoData, setStepTwoData] = useState<StepTwoData>({
    app:
      initialData?.appId && initialData?.appName
        ? {appId: initialData.appId, name: initialData.appName}
        : undefined,
  });

  const [stepThreeData, setStepThreeData] = useState<StepThreeData>({
    username: initialData?.itunesUser,
    password: initialData?.itunesPassword,
  });

  const [stepFourData, setStepFourData] = useState<StepFourData>({
    authenticationCode: undefined,
  });

  const [stepFifthData, setStepFifthData] = useState<StepFifthData>({
    org:
      initialData?.orgId && initialData?.name
        ? {organizationId: initialData.orgId, name: initialData.name}
        : undefined,
  });

  useEffect(() => {
    if (shouldRevalidateItunesSession) {
      handleStartItunesAuthentication();
    }
  }, [shouldRevalidateItunesSession]);

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
    } catch (error) {
      setIsLoading(false);
      addErrorMessage(
        t(
          'We could not establish a connection with App Store Connect. Please check the entered App Store Connect credentials.'
        )
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
            code: stepFourData.authenticationCode,
            useSms,
            sessionContext,
          },
        }
      );
      setIsLoading(false);
      const {organizations, sessionContext: newSessionContext} = response;
      setStepFifthData({org: organizations[0]});
      setAppleStoreOrgs(organizations);
      setSessionContext(newSessionContext);
      goNext();
    } catch (error) {
      setIsLoading(false);
      addErrorMessage(
        t('The two factor authentication failed. Please check the entered code.')
      );
    }
  }

  async function persistData() {
    if (!stepTwoData.app || !stepFifthData.org || !stepThreeData.username) {
      return;
    }
    setIsLoading(true);

    let endpoint = `/projects/${orgSlug}/${projectSlug}/appstoreconnect/`;
    let successMessage = t('App Store Connect repository was successfully added.');
    let errorMessage = t(
      'An error occured while adding the App Store Connect repository.'
    );

    if (!!initialData) {
      endpoint = `${endpoint}${initialData.id}/`;
      successMessage = t('App Store Connect repository was successfully updated.');
      errorMessage = t(
        'An error occured while updating the App Store Connect repository.'
      );
    }

    try {
      const response = await api.requestPromise(endpoint, {
        method: 'POST',
        data: {
          itunesUser: stepThreeData.username,
          itunesPassword: stepThreeData.password,
          appconnectIssuer: stepOneData.issuer,
          appconnectKey: stepOneData.keyId,
          appconnectPrivateKey: stepOneData.privateKey,
          appName: stepTwoData.app.name,
          appId: stepTwoData.app.appId,
          orgId: stepFifthData.org.organizationId,
          orgName: stepFifthData.org.name,
          sessionContext,
        },
      });
      addSuccessMessage(successMessage);
      onSubmit(response);
      closeModal();
    } catch (error) {
      setIsLoading(false);
      addErrorMessage(errorMessage);
    }
  }

  function isFormInValid() {
    switch (activeStep) {
      case 0:
        return Object.keys(stepOneData).some(key => !stepOneData[key]);
      case 1:
        return Object.keys(stepTwoData).some(key => !stepTwoData[key]);
      case 2: {
        return Object.keys(stepThreeData).some(key => !stepThreeData[key]);
      }
      case 3: {
        return Object.keys(stepFourData).some(key => !stepFourData[key]);
      }
      case 4: {
        return Object.keys(stepFifthData).some(key => !stepFifthData[key]);
      }
      default:
        return false;
    }
  }

  function goNext() {
    setActiveStep(activeStep + 1);
  }

  async function handleStartItunesAuthentication(shouldGoNext = true) {
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
            itunesUser: stepThreeData.username,
            itunesPassword: stepThreeData.password,
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

  async function handleStartSmsAuthentication() {
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

  function handleGoBack() {
    const newActiveStep = activeStep - 1;

    switch (newActiveStep) {
      case 3:
        handleStartItunesAuthentication(false);
        setStepFourData({authenticationCode: undefined});
        break;
      default:
        break;
    }

    setActiveStep(newActiveStep);
  }

  function handleGoNext() {
    switch (activeStep) {
      case 0:
        checkAppStoreConnectCredentials();
        break;
      case 1:
        goNext();
        break;
      case 2:
        handleStartItunesAuthentication();
        break;
      case 3:
        startTwoFactorAuthentication();
        break;
      case 4:
        persistData();
        break;
      default:
        break;
    }
  }

  function renderCurrentStep() {
    switch (activeStep) {
      case 0:
        return <StepOne stepOneData={stepOneData} onSetStepOneData={setStepOneData} />;
      case 1:
        return (
          <StepTwo
            appStoreApps={appStoreApps}
            stepTwoData={stepTwoData}
            onSetStepTwoData={setStepTwoData}
          />
        );
      case 2:
        return (
          <StepThree stepThreeData={stepThreeData} onSetStepOneData={setStepThreeData} />
        );
      case 3:
        return (
          <StepFour
            stepFourData={stepFourData}
            onSetStepFourData={setStepFourData}
            onStartItunesAuthentication={handleStartItunesAuthentication}
            onStartSmsAuthentication={handleStartSmsAuthentication}
          />
        );
      case 4:
        return (
          <StepFifth
            appleStoreOrgs={appleStoreOrgs}
            stepFifthData={stepFifthData}
            onSetStepFifthData={setStepFifthData}
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

  function getAlerts() {
    const alerts: React.ReactElement[] = [];

    if (revalidateItunesSession && appStoreConnectContext?.itunesSessionValid === true) {
      alerts.push(
        <StyledAlert type="warning" icon={<IconInfo />}>
          {t('Your iTunes session has already been re-validated.')}
        </StyledAlert>
      );
    }

    if (appStoreConnectContext?.appstoreCredentialsValid === false && activeStep === 0) {
      alerts.push(
        <StyledAlert type="warning" icon={<IconWarning />}>
          {t(
            'Your App Store Connect credentials are invalid. To reconnect, update your credentials.'
          )}
        </StyledAlert>
      );
    }

    if (appStoreConnectContext?.itunesSessionValid === false && activeStep < 3) {
      alerts.push(
        <StyledAlert type="warning" icon={<IconWarning />}>
          {t(
            'Your iTunes session has expired. To reconnect, sign in with your Apple ID and password.'
          )}
        </StyledAlert>
      );
    }

    if (appStoreConnectContext?.itunesSessionValid === false && activeStep === 3) {
      alerts.push(
        <StyledAlert type="warning" icon={<IconWarning />}>
          {t('Enter your authentication code to re-validate your iTunes session.')}
        </StyledAlert>
      );
    }

    return alerts;
  }

  function renderBodyContent() {
    const alerts = getAlerts();

    return (
      <Fragment>
        {!!alerts.length && (
          <Alerts marginBottom={activeStep === 3 ? 1.5 : 3}>
            {alerts.map((alert, index) => (
              <Fragment key={index}>{alert}</Fragment>
            ))}
          </Alerts>
        )}
        {renderCurrentStep()}
      </Fragment>
    );
  }

  return (
    <Fragment>
      <Header closeButton>
        <HeaderContent>
          <NumericSymbol>{activeStep + 1}</NumericSymbol>
          <HeaderContentTitle>{steps[activeStep]}</HeaderContentTitle>
          <StepsOverview>
            {tct('[currentStep] of [totalSteps]', {
              currentStep: activeStep + 1,
              totalSteps: steps.length,
            })}
          </StepsOverview>
        </HeaderContent>
      </Header>
      {appStoreConnectContext?.isLoading !== false ? (
        <Body>
          <LoadingIndicator />
        </Body>
      ) : (
        <Fragment>
          <Body>{renderBodyContent()}</Body>
          <Footer>
            <ButtonBar gap={1}>
              {activeStep !== 0 && <Button onClick={handleGoBack}>{t('Back')}</Button>}
              <StyledButton
                priority="primary"
                onClick={handleGoNext}
                disabled={
                  isFormInValid() ||
                  isLoading ||
                  appStoreConnectContext?.isLoading !== false
                }
              >
                {isLoading && (
                  <LoadingIndicatorWrapper>
                    <LoadingIndicator mini />
                  </LoadingIndicatorWrapper>
                )}
                {activeStep + 1 === steps.length
                  ? initialData
                    ? t('Update')
                    : t('Save')
                  : steps[activeStep + 1]}
              </StyledButton>
            </ButtonBar>
          </Footer>
        </Fragment>
      )}
    </Fragment>
  );
}

export default withApi(AppStoreConnect);

const HeaderContent = styled('div')`
  display: grid;
  grid-template-columns: max-content max-content 1fr;
  align-items: center;
  grid-gap: ${space(1)};
`;

const NumericSymbol = styled('div')`
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  font-weight: 700;
  font-size: ${p => p.theme.fontSizeMedium};
  background-color: ${p => p.theme.yellow300};
`;

const HeaderContentTitle = styled('div')`
  font-weight: 700;
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const StepsOverview = styled('div')`
  color: ${p => p.theme.gray300};
  display: flex;
  justify-content: flex-end;
`;

const LoadingIndicatorWrapper = styled('div')`
  height: 100%;
  position: absolute;
  width: 100%;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const StyledButton = styled(Button)`
  position: relative;
`;

const Alerts = styled('div')<{marginBottom: ValidSize}>`
  display: grid;
  grid-gap: ${space(1.5)};
  margin-bottom: ${p => space(p.marginBottom)};
`;

const StyledAlert = styled(Alert)`
  margin: 0;
`;

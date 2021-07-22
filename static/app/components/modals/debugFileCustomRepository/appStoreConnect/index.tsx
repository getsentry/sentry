import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import AlertLink from 'app/components/alertLink';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import LoadingIndicator from 'app/components/loadingIndicator';
import {AppStoreConnectContextProps} from 'app/components/projects/appStoreConnectContext';
import {appStoreConnectAlertMessage} from 'app/components/projects/appStoreConnectContext/utils';
import {IconWarning} from 'app/icons';
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

type SessionContext = {
  auth_key: string;
  scnt: string;
  session_id: string;
};

type ItunesRevalidationSessionContext = SessionContext & {
  itunes_created: string;
  itunes_person_id: string;
  itunes_session: string;
};

type InitialData = {
  appId: string;
  appName: string;
  appconnectIssuer: string;
  appconnectKey: string;
  appconnectPrivateKey: string;
  bundleId: string;
  id: string;
  itunesCreated: string;
  itunesPassword: string;
  itunesPersonId: string;
  itunesSession: string;
  itunesUser: string;
  name: string;
  orgId: number;
  orgName: string;
  type: string;
};

type Props = Pick<ModalRenderProps, 'Header' | 'Body' | 'Footer'> & {
  api: Client;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
  onSubmit: (data: InitialData) => void;
  location: Location;
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
  api,
  initialData,
  orgSlug,
  projectSlug,
  onSubmit,
  location,
  appStoreConnectContext,
}: Props) {
  const {updateAlertMessage} = appStoreConnectContext ?? {};

  const [revalidateItunesSession, setRevalidateItunesSession] = useState(
    location.query.revalidateItunesSession
  );
  const [isLoading, setIsLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(revalidateItunesSession ? 3 : 0);
  const [appStoreApps, setAppStoreApps] = useState<AppStoreApp[]>([]);
  const [appleStoreOrgs, setAppleStoreOrgs] = useState<AppleStoreOrg[]>([]);
  const [useSms, setUseSms] = useState(false);
  const [sessionContext, setSessionContext] = useState<SessionContext | undefined>(
    undefined
  );

  const [stepOneData, setStepOneData] = useState<StepOneData>({
    issuer: initialData?.appconnectIssuer,
    keyId: initialData?.appconnectKey,
    privateKey: initialData?.appconnectPrivateKey,
  });

  const [stepTwoData, setStepTwoData] = useState<StepTwoData>({
    app:
      initialData?.appId && initialData?.appName
        ? {
            appId: initialData.appId,
            name: initialData.appName,
            bundleId: initialData.bundleId,
          }
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
    if (location.query.revalidateItunesSession && !revalidateItunesSession) {
      setIsLoading(true);
      setRevalidateItunesSession(location.query.revalidateItunesSession);
    }
  }, [location.query]);

  useEffect(() => {
    if (revalidateItunesSession) {
      handleStartItunesAuthentication(false);
      if (activeStep !== 3) {
        setActiveStep(3);
      }
      setIsLoading(false);
      return;
    }
    setIsLoading(false);
  }, [revalidateItunesSession]);

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

  async function startTwoFactorAuthentication(shouldJumpNext = false) {
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

      const {organizations, sessionContext: newSessionContext} = response;

      if (shouldJumpNext) {
        persistData(newSessionContext);
        return;
      }

      setSessionContext(newSessionContext);
      setAppleStoreOrgs(organizations);
      setStepFifthData({org: organizations[0]});
      setIsLoading(false);
      goNext();
    } catch (error) {
      setIsLoading(false);
      addErrorMessage(
        t('The two factor authentication failed. Please check the entered code.')
      );
    }
  }

  async function persistData(newSessionContext?: ItunesRevalidationSessionContext) {
    if (!stepTwoData.app || !stepFifthData.org || !stepThreeData.username) {
      return;
    }

    setIsLoading(true);

    let endpoint = `/projects/${orgSlug}/${projectSlug}/appstoreconnect/`;

    let errorMessage = t(
      'An error occured while adding the App Store Connect repository.'
    );

    if (!!initialData) {
      endpoint = `${endpoint}${initialData.id}/`;

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
          bundleId: stepTwoData.app.bundleId,
          orgId: stepFifthData.org.organizationId,
          orgName: stepFifthData.org.name,
          sessionContext: newSessionContext ?? sessionContext,
        },
      });
      onSubmit(response as InitialData);
    } catch (error) {
      setIsLoading(false);
      addErrorMessage(errorMessage);
    }
  }

  function isFormInvalid() {
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
        return;
      }

      addSuccessMessage(t('An iTunes verification code has been sent'));
    } catch {
      if (shouldGoNext) {
        setIsLoading(false);
      }
      addErrorMessage(
        t('The iTunes authentication failed. Please check the provided credentials')
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
      addSuccessMessage(t("We've sent a SMS code to your phone"));
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

    if (revalidateItunesSession) {
      if (!updateAlertMessage && revalidateItunesSession) {
        alerts.push(
          <StyledAlert type="warning" icon={<IconWarning />}>
            {t('Your iTunes session has already been re-validated.')}
          </StyledAlert>
        );
      }

      return alerts;
    }

    if (activeStep !== 0) {
      return alerts;
    }

    if (updateAlertMessage === appStoreConnectAlertMessage.appStoreCredentialsInvalid) {
      alerts.push(
        <StyledAlert type="warning" icon={<IconWarning />}>
          {t(
            'Your App Store Connect credentials are invalid. To reconnect, update your credentials.'
          )}
        </StyledAlert>
      );
    }

    if (updateAlertMessage === appStoreConnectAlertMessage.iTunesSessionInvalid) {
      alerts.push(
        <AlertLink
          withoutMarginBottom
          icon={<IconWarning />}
          to={{
            pathname: location.pathname,
            query: {
              ...location.query,
              revalidateItunesSession: true,
            },
          }}
        >
          {t('Your iTunes session has expired. To reconnect, revalidate the session.')}
        </AlertLink>
      );
    }

    if (
      updateAlertMessage ===
      appStoreConnectAlertMessage.isTodayAfterItunesSessionRefreshAt
    ) {
      alerts.push(
        <AlertLink
          withoutMarginBottom
          icon={<IconWarning />}
          to={{
            pathname: location.pathname,
            query: {
              ...location.query,
              revalidateItunesSession: true,
            },
          }}
        >
          {t(
            'Your iTunes session will likely expire soon. We recommend that you revalidate the session.'
          )}
        </AlertLink>
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

  if (initialData && !appStoreConnectContext) {
    return <LoadingIndicator />;
  }

  if (revalidateItunesSession) {
    return (
      <Fragment>
        <Header closeButton>
          <HeaderContentTitle>{t('Revalidate iTunes session')}</HeaderContentTitle>
        </Header>
        <Body>{renderBodyContent()}</Body>
        <Footer>
          <StyledButton
            priority="primary"
            onClick={() => startTwoFactorAuthentication(true)}
            disabled={isLoading || isFormInvalid()}
          >
            {t('Revalidate')}
          </StyledButton>
        </Footer>
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
      <Body>{renderBodyContent()}</Body>
      <Footer>
        <ButtonBar gap={1}>
          {activeStep !== 0 && <Button onClick={handleGoBack}>{t('Back')}</Button>}
          <StyledButton
            priority="primary"
            onClick={handleGoNext}
            disabled={isLoading || isFormInvalid()}
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

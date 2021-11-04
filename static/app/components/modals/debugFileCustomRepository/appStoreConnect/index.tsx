import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import LoadingIndicator from 'app/components/loadingIndicator';
import {AppStoreConnectContextProps} from 'app/components/projects/appStoreConnectContext';
import {IconWarning} from 'app/icons';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import withApi from 'app/utils/withApi';

import StepOne from './stepOne';
import StepTwo from './stepTwo';
import {AppStoreApp, StepOneData, StepTwoData} from './types';
import {getAppStoreErrorMessage, unexpectedErrorMessage} from './utils';

type InitialData = {
  type: string;
  appId: string;
  appName: string;
  appconnectIssuer: string;
  appconnectKey: string;
  appconnectPrivateKey: {
    'hidden-secret': boolean;
  };
  bundleId: string;
  id: string;
  name: string;
};

type Props = Pick<ModalRenderProps, 'Header' | 'Body' | 'Footer'> & {
  api: Client;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
  onSubmit: () => void;
  appStoreConnectContext?: AppStoreConnectContextProps;
  initialData?: InitialData;
};

const steps = [t('App Store Connect credentials'), t('Choose an application')];

function AppStoreConnect({
  Header,
  Body,
  Footer,
  api,
  initialData,
  orgSlug,
  projectSlug,
  onSubmit,
  appStoreConnectContext,
}: Props) {
  const {credentials} = appStoreConnectContext ?? {};

  const [isLoading, setIsLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [appStoreApps, setAppStoreApps] = useState<AppStoreApp[]>([]);

  const [stepOneData, setStepOneData] = useState<StepOneData>({
    issuer: initialData?.appconnectIssuer,
    keyId: initialData?.appconnectKey,
    privateKey: typeof initialData?.appconnectPrivateKey === 'object' ? undefined : '',
    errors: undefined,
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

  async function checkAppStoreConnectCredentials() {
    setIsLoading(true);

    try {
      const response = await api.requestPromise(
        `/projects/${orgSlug}/${projectSlug}/appstoreconnect/apps/`,
        {
          method: 'POST',
          data: {
            id: stepOneData.privateKey !== undefined ? undefined : initialData?.id,
            appconnectIssuer: stepOneData.issuer,
            appconnectKey: stepOneData.keyId,
            appconnectPrivateKey: stepOneData.privateKey,
          },
        }
      );

      setAppStoreApps(response.apps);

      if (
        stepTwoData.app?.appId &&
        !response.apps.find(app => app.appId === stepTwoData.app?.appId)
      ) {
        setStepTwoData({app: response.apps[0]});
      }

      setIsLoading(false);
      goNext();
    } catch (error) {
      setIsLoading(false);
      const appStoreConnnectError = getAppStoreErrorMessage(error);
      if (typeof appStoreConnnectError === 'string') {
        // app-connect-authentication-error
        // 'app-connect-forbidden-error'
        addErrorMessage(appStoreConnnectError);
        return;
      }
      setStepOneData({...stepOneData, errors: appStoreConnnectError});
    }
  }

  async function persistData() {
    if (!stepTwoData.app) {
      return;
    }

    setIsLoading(true);

    let endpoint = `/projects/${orgSlug}/${projectSlug}/appstoreconnect/`;
    let errorMessage = t('An error occurred while adding the custom repository');
    let successMessage = t('Successfully added custom repository');

    if (!!initialData) {
      endpoint = `${endpoint}${initialData.id}/`;
      errorMessage = t('An error occurred while updating the custom repository');
      successMessage = t('Successfully updated custom repository');
    }

    try {
      await api.requestPromise(endpoint, {
        method: 'POST',
        data: {
          appconnectIssuer: stepOneData.issuer,
          appconnectKey: stepOneData.keyId,
          appconnectPrivateKey: stepOneData.privateKey,
          appName: stepTwoData.app.name,
          appId: stepTwoData.app.appId,
          bundleId: stepTwoData.app.bundleId,
        },
      });

      addSuccessMessage(successMessage);
      onSubmit();
    } catch (error) {
      setIsLoading(false);
      const appStoreConnnectError = getAppStoreErrorMessage(error);

      if (typeof appStoreConnnectError === 'string') {
        if (appStoreConnnectError === unexpectedErrorMessage) {
          addErrorMessage(errorMessage);
          return;
        }
        addErrorMessage(appStoreConnnectError);
      }
    }
  }

  function isFormInvalid() {
    switch (activeStep) {
      case 0:
        return Object.keys(stepOneData).some(key => {
          if (key === 'errors') {
            const errors = stepOneData[key] ?? {};
            return Object.keys(errors).some(error => !!errors[error]);
          }

          if (key === 'privateKey' && stepOneData[key] === undefined) {
            return false;
          }

          return !stepOneData[key];
        });
      case 1:
        return Object.keys(stepTwoData).some(key => !stepTwoData[key]);
      default:
        return false;
    }
  }

  function goNext() {
    setActiveStep(activeStep + 1);
  }

  function handleGoBack() {
    const newActiveStep = activeStep - 1;
    setActiveStep(newActiveStep);
  }

  function handleGoNext() {
    switch (activeStep) {
      case 0:
        checkAppStoreConnectCredentials();
        break;
      case 1:
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

    if (activeStep !== 0) {
      return alerts;
    }
    if (credentials?.status === 'invalid') {
      switch (credentials.code) {
        case 'app-connect-forbidden-error':
          alerts.push(
            <StyledAlert type="warning" icon={<IconWarning />}>
              {t(
                'Your App Store Connect credentials have insufficient permissions. To reconnect, update your credentials.'
              )}
            </StyledAlert>
          );
          break;
        case 'app-connect-authentication-error':
        default:
          alerts.push(
            <StyledAlert type="warning" icon={<IconWarning />}>
              {t(
                'Your App Store Connect credentials are invalid. To reconnect, update your credentials.'
              )}
            </StyledAlert>
          );
      }
    }

    return alerts;
  }

  function renderBodyContent() {
    const alerts = getAlerts();

    return (
      <Fragment>
        {!!alerts.length && (
          <Alerts>
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

const Alerts = styled('div')`
  display: grid;
  grid-gap: ${space(1.5)};
  margin-bottom: ${space(3)};
`;

const StyledAlert = styled(Alert)`
  margin: 0;
`;

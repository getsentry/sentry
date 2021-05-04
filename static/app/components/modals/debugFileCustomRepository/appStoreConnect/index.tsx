import React, {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import LoadingIndicator from 'app/components/loadingIndicator';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {Theme} from 'app/utils/theme';
import withApi from 'app/utils/withApi';

import StepFour from './stepFour';
import StepOne from './stepOne';
import StepThree from './stepThree';
import StepTwo from './stepTwo';
import {
  App,
  AppleStoreOrg,
  StepFourData,
  StepOneData,
  StepThreeData,
  StepTwoData,
} from './types';

const steps = [
  t('Enter your App Store Connect credentials'),
  t('Enter your itunes credentials'),
  t('Enter your authentication code'),
  t('Choose an organization and application'),
];

type Status = 'waiting' | 'active' | 'finished';

type Props = Pick<ModalRenderProps, 'Body' | 'Footer' | 'closeModal'> & {
  api: Client;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
};

function AppStoreConnect({Body, Footer, closeModal, api, orgSlug, projectSlug}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [stepHeights, setStepHeights] = useState<number[]>([]);
  const [appStoreApps, setAppStoreApps] = useState<App[]>([]);
  const [appStoreOrgs, setAppStoreOrgs] = useState<AppleStoreOrg[]>([]);
  const [sessionContext, setSessionContext] = useState('');
  const [useSms, setUseSms] = useState(false);

  const listRef = useRef<HTMLOListElement>(null);

  const [stepOneData, setStepOneData] = useState<StepOneData>({
    issuer: undefined,
    keyId: undefined,
    privateKey: undefined,
  });

  const [stepTwoData, setStepTwoData] = useState<StepTwoData>({
    username: undefined,
    password: undefined,
  });

  const [stepThreeData, setStepThreeData] = useState<StepThreeData>({
    authenticationCode: undefined,
  });

  const [stepFourData, setStepFourData] = useState<StepFourData>({
    org: undefined,
    app: undefined,
  });

  useEffect(() => {
    calcStepContentHeights();
  }, []);

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

  async function startItunesAuthentication(shouldGoNext = true) {
    setIsLoading(true);
    if (useSms) {
      setUseSms(false);
    }
    try {
      const response = await api.requestPromise(
        `/projects/${orgSlug}/${projectSlug}/appstoreconnect/start/`,
        {
          method: 'POST',
          data: {
            itunesUser: stepTwoData.username,
            itunesPassword: stepTwoData.password,
          },
        }
      );

      setSessionContext(response.sessionContext);
      setIsLoading(false);
      if (shouldGoNext) {
        goNext();
      }
    } catch (error) {
      setIsLoading(false);
      addErrorMessage(
        t('The iTunes authentication failed. Please check the entered credentials.')
      );
    }
  }

  async function startSmsAuthentication() {
    setIsLoading(true);
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

      setIsLoading(false);
      setSessionContext(response.sessionContext);
    } catch (error) {
      setIsLoading(false);
      addErrorMessage(t('An error occured while sending the SMS. Please try again'));
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
            code: stepThreeData.authenticationCode,
            useSms,
            sessionContext,
          },
        }
      );
      setIsLoading(false);
      const {organizations, sessionContext: newSessionContext} = response;
      setStepFourData({org: organizations[0], app: appStoreApps[0]});
      setAppStoreOrgs(organizations);
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
    if (!stepFourData.app || !stepFourData.org || !stepTwoData.username) {
      return;
    }
    setIsLoading(true);
    try {
      await api.requestPromise(`/projects/${orgSlug}/${projectSlug}/appstoreconnect/`, {
        method: 'POST',
        data: {
          itunesUser: stepTwoData.username,
          itunesPassword: stepTwoData.password,
          appconnectIssuer: stepOneData.issuer,
          appconnectKey: stepOneData.keyId,
          appconnectPrivateKey: stepOneData.privateKey,
          appName: stepFourData.app.name,
          appId: stepFourData.app.appId,
          orgId: stepFourData.org.organizationId,
          orgName: stepFourData.org.name,
          sessionContext,
        },
      });
      addSuccessMessage('App Store Connect repository was successfully added');
      closeModal();
    } catch (error) {
      setIsLoading(false);
      addErrorMessage(t('An error occured while saving the repository'));
    }
  }

  function isFormInValid() {
    switch (activeStep) {
      case 0:
        return Object.keys(stepOneData).some(key => !stepOneData[key]?.trim());
      case 1:
        return Object.keys(stepTwoData).some(key => !stepTwoData[key]?.trim());
      case 2: {
        return Object.keys(stepThreeData).some(key => !stepThreeData[key]);
      }
      case 3: {
        return Object.keys(stepFourData).some(key => !stepFourData[key]);
      }
      default:
        return false;
    }
  }

  function calcStepContentHeights() {
    const listElement = listRef.current;
    if (listElement) {
      const newStepHeights = steps.map(
        (_step, index) => (listElement.children[index] as HTMLLIElement).offsetHeight
      );

      setStepHeights(newStepHeights);
    }
  }

  function goNext() {
    setActiveStep(prevActiveStep => prevActiveStep + 1);
  }

  function handleBack() {
    setActiveStep(prevActiveStep => prevActiveStep - 1);
  }

  function handleSaveAction() {
    switch (activeStep) {
      case 0:
        checkAppStoreConnectCredentials();
        break;
      case 1:
        startItunesAuthentication();
        break;
      case 2:
        startTwoFactorAuthentication();
        break;
      case 3:
        persistData();
        break;
      default:
        break;
    }
  }

  function renderStepContent(stepIndex: number) {
    switch (stepIndex) {
      case 0:
        return <StepOne data={stepOneData} onChange={setStepOneData} />;
      case 1:
        return <StepTwo data={stepTwoData} onChange={setStepTwoData} />;
      case 2:
        return (
          <StepThree
            data={stepThreeData}
            onChange={setStepThreeData}
            onSendVerificationCode={() => startItunesAuthentication(false)}
            onSendCodeViaSms={() => startSmsAuthentication()}
          />
        );
      case 3:
        return (
          <StepFour
            orgs={appStoreOrgs}
            apps={appStoreApps}
            data={stepFourData}
            onChange={setStepFourData}
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
    <React.Fragment>
      <Body>
        <StyledList
          symbol="colored-numeric"
          forwardRef={listRef}
          defineItemHeight={!!stepHeights.length}
        >
          {steps.map((step, index) => {
            const isActive = activeStep === index || !stepHeights.length;
            return (
              <StyledItem
                key={step}
                status={activeStep < index ? 'waiting' : isActive ? 'active' : 'finished'}
                height={stepHeights[index]}
              >
                {steps[index]}
                {isActive && renderStepContent(index)}
              </StyledItem>
            );
          })}
        </StyledList>
      </Body>
      <Footer>
        <ButtonBar gap={1.5}>
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          {activeStep !== 0 && <Button onClick={handleBack}>{t('Back')}</Button>}
          <StyledButton
            priority="primary"
            onClick={handleSaveAction}
            disabled={isFormInValid() || isLoading}
          >
            {isLoading && (
              <LoadingIndicatorWrapper>
                <LoadingIndicator mini />
              </LoadingIndicatorWrapper>
            )}
            {activeStep === 3 ? t('Save') : t('Next')}
          </StyledButton>
        </ButtonBar>
      </Footer>
    </React.Fragment>
  );
}

export default withApi(AppStoreConnect);

const StyledList = styled(List, {
  shouldForwardProp: p => p !== 'defineItemHeight',
})<{defineItemHeight: boolean}>`
  grid-gap: 0;
  & > li {
    transition: height 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;
    :not(:last-child) {
      padding-bottom: ${space(2)};
      :after {
        content: ' ';
        height: calc(100% - 24px - ${space(1)});
        width: 1px;
        background-color: ${p => p.theme.gray200};
        position: absolute;
        top: calc(24px + ${space(0.5)});
        left: ${space(1.5)};
      }
    }

    ${p =>
      p.defineItemHeight &&
      `
        height: 32px;
        :not(:last-child) {
          height: 52px;
          padding-bottom: 0;
        }
      `}
  }
`;

const getStatusStyle = (theme: Theme, status: Status, height: number) => {
  if (status === 'active') {
    const heightStyle = height ? `height: ${height}px;` : '';
    return `
      && {
        :not(:last-child) {
          ${heightStyle}
          padding-bottom: 0;
        }
        ${heightStyle}
      }
    `;
  }

  if (status === 'waiting') {
    return `
      &&:before {
        background-color: ${theme.disabled};
        color: ${theme.white};
      }
      color: ${theme.disabled};
    `;
  }

  return '';
};

const StyledItem = styled(ListItem)<{status: Status; height: number}>`
  ${p => getStatusStyle(p.theme, p.status, p.height)}
`;

const StyledButton = styled(Button)`
  position: relative;
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

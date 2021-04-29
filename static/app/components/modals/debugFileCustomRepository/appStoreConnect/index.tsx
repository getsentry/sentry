import React, {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import withApi from 'app/utils/withApi';

import StepFour from './stepFour';
import StepOne from './stepOne';
import StepThree from './stepThree';
import StepTwo from './stepTwo';
import {App, StepFourData, StepOneData, StepThreeData, StepTwoData} from './types';

type Props = Pick<ModalRenderProps, 'Body' | 'Footer' | 'closeModal'> & {
  api: Client;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
};

function AppStoreConnect({Body, Footer, closeModal, api, orgSlug, projectSlug}: Props) {
  const [activeStep, setActiveStep] = useState(0);
  const [apps, setApps] = useState<App[]>([]);
  const [sessionContext, setSessionContext] = useState('');
  const [twoFASessionContext, setTwoFASessionContext] = useState('');
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
    itunesAuthenticationCode: undefined,
  });

  const [stepFourData, setStepFourData] = useState<StepFourData>({
    app: undefined,
  });

  useEffect(() => {
    if (useSms) {
      startSmsAuthentication();
    }
  }, [useSms]);

  useEffect(() => {
    // console.log(' listRef.current', listRef.current);
  }, [activeStep]);

  function handleNext() {
    setActiveStep(prevActiveStep => prevActiveStep + 1);
  }

  function handleBack() {
    setActiveStep(prevActiveStep => prevActiveStep - 1);
  }

  async function checkAppStoreConnectCredentials() {
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

      setApps(response.apps);
      handleNext();
    } catch (error) {
      addErrorMessage(
        t(
          'We could not establish a connection with App Store Connect. Please check the entered App Store Connect credentials.'
        )
      );
    }
  }

  async function startItunesAuthentication() {
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
      handleNext();
    } catch (error) {
      addErrorMessage(
        t('The iTunes authentication failed. Please check the entered credentials.')
      );
    }
  }

  async function startTwoFactorAuthentication() {
    try {
      const response = await api.requestPromise(
        `projects/${orgSlug}/${projectSlug}/appstoreconnect/2fa/`,
        {
          method: 'POST',
          data: {
            code: stepThreeData.itunesAuthenticationCode,
            useSms,
            sessionContext,
          },
        }
      );

      setTwoFASessionContext(response);
      handleNext();
    } catch (error) {
      addErrorMessage(
        t('The two factor authentication failed. Please check the entered code.')
      );
    }
  }

  async function startSmsAuthentication() {
    try {
      await api.requestPromise(
        `projects/${orgSlug}/${projectSlug}/appstoreconnect/requestSms/`,
        {
          method: 'POST',
          data: {sessionContext},
        }
      );
    } catch (error) {
      addErrorMessage(t('An error occured while sending the SMS. Please try again'));
    }
  }

  async function persistData() {
    try {
      await api.requestPromise(`projects/${orgSlug}/${projectSlug}/appstoreconnect/`, {
        method: 'POST',
        data: {
          appName: stepFourData.app?.name,
          appId: stepFourData.app?.appId,
          itunesUser: stepTwoData.username,
          itunesPassword: stepTwoData.password,
          appconnectIssuer: stepOneData.issuer,
          appconnectKey: stepOneData.keyId,
          appconnectPrivateKey: stepOneData.privateKey,
          sessionContext: twoFASessionContext,
        },
      });

      closeModal();
      addSuccessMessage('App Store Connect repository was successfully added');
    } catch (error) {
      addErrorMessage(t('An error occured while saving the repository'));
    }
  }

  function handleSaveAction() {
    switch (activeStep) {
      case 0:
        checkAppStoreConnectCredentials();
        break;
      case 1:
        startItunesAuthentication();
        setUseSms(false);
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

  function isFormInValid() {
    switch (activeStep) {
      case 0:
        return Object.keys(stepOneData).some(key => !stepOneData[key]?.trim());
      case 1:
        return Object.keys(stepTwoData).some(key => !stepTwoData[key]?.trim());
      case 2:
        return Object.keys(StepThree).some(key => !StepThree[key]);
      default:
        return false;
    }
  }

  return (
    <React.Fragment>
      <Body>
        <StyledList symbol="colored-numeric" forwardRef={listRef}>
          <StyledItem isActive={activeStep === 0}>
            <StepOne
              data={stepOneData}
              onChange={setStepOneData}
              isActive={activeStep === 0}
            />
          </StyledItem>
          <StyledItem isWaiting={activeStep < 1} isActive={activeStep === 1}>
            <StepTwo
              data={stepTwoData}
              onChange={setStepTwoData}
              isActive={activeStep === 1}
            />
          </StyledItem>
          <StyledItem isWaiting={activeStep < 2} isActive={activeStep === 2}>
            <StepThree
              data={stepThreeData}
              onChange={setStepThreeData}
              useSms={useSms}
              onSendCodeViaSms={() => setUseSms(true)}
              isActive={activeStep === 2}
            />
          </StyledItem>
          <StyledItem isWaiting={activeStep < 3} isActive={activeStep === 3}>
            <StepFour
              apps={apps}
              data={stepFourData}
              onChange={setStepFourData}
              isActive={activeStep === 3}
            />
          </StyledItem>
        </StyledList>
      </Body>
      <Footer>
        <ButtonBar gap={1.5}>
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          {activeStep !== 0 && <Button onClick={handleBack}>{t('Back')}</Button>}
          <Button
            priority="primary"
            onClick={handleSaveAction}
            disabled={isFormInValid()}
          >
            {activeStep === 3 ? t('Save') : t('Next')}
          </Button>
        </ButtonBar>
      </Footer>
    </React.Fragment>
  );
}

export default withApi(AppStoreConnect);

const StyledList = styled(List)`
  grid-gap: 0;
  & > li {
    height: 52px;
    overflow: hidden;
    transition: height 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;
    :not(:last-child) {
      padding-bottom: ${space(4)};
      :after {
        content: ' ';
        height: calc(100% - 24px - ${space(1)});
        width: 1px;
        background-color: ${p => p.theme.gray200};
        position: absolute;
        top: calc(24px + ${space(0.5)});
        left: 12px;
      }
    }
  }
`;

const StyledItem = styled(ListItem)<{isActive: boolean; isWaiting?: boolean}>`
  ${p =>
    p.isWaiting &&
    `
      &&:before {
        background-color: ${p.theme.disabled};
        color: ${p.theme.white};
      }
      color: ${p.theme.disabled};
    `}
  ${p =>
    p.isActive &&
    `
      &&:not(:last-child) {
        padding-bottom: ${space(3)};
        height: 200px;
      }
    `}
`;

import React, {useState} from 'react';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import withApi from 'app/utils/withApi';

import StepOne from './stepOne';
import StepThree from './stepThree';
import StepTwo from './stepTwo';
import {App, StepOneData, StepThreeData, StepTwoData} from './types';

type Props = Pick<ModalRenderProps, 'Body' | 'Footer' | 'closeModal'> & {
  api: Client;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
};

function AppStoreConnect({Body, Footer, closeModal, api, orgSlug, projectSlug}: Props) {
  const [activeStep, setActiveStep] = useState(0);
  const [apps, setApps] = useState<App[]>([]);
  const [sessionContext, setSessionContext] = useState('');

  const [stepOneData, setStepOneData] = useState<StepOneData>({
    issuer: undefined,
    keyId: undefined,
    privateKey: undefined,
  });

  const [stepTwoData, setStepTwoData] = useState<StepTwoData>({
    username: undefined,
    password: undefined,
  });

  const [stepThree, setStepThree] = useState<StepThreeData>({
    app: undefined,
  });

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

      setSessionContext(response);
      handleNext();
    } catch (error) {
      addErrorMessage(
        t('The iTunes authentication failed. Please check the entered credentials.')
      );
    }
  }

  function handleSave() {
    switch (activeStep) {
      case 0:
        checkAppStoreConnectCredentials();
        break;
      case 1:
        startItunesAuthentication();
        break;
      case 2:
        break;
      default:
        break;
    }
  }

  console.log('apps', apps);

  function renderActiveStep() {
    switch (activeStep) {
      case 0:
        return <StepOne data={stepOneData} onChange={setStepOneData} />;
      case 1:
        return <StepTwo data={stepTwoData} onChange={setStepTwoData} />;
      case 2:
        return null;
      default:
        return (
          <Alert type="error" icon={<IconWarning />}>
            {t('This step could not be found.')}
          </Alert>
        );
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
      <Body>{renderActiveStep()}</Body>
      <Footer>
        <ButtonBar gap={1.5}>
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          {activeStep !== 0 && <Button onClick={handleBack}>{t('Back')}</Button>}
          <Button priority="primary" onClick={handleSave} disabled={isFormInValid()}>
            {activeStep === 3 ? t('Save') : t('Next')}
          </Button>
        </ButtonBar>
      </Footer>
    </React.Fragment>
  );
}

export default withApi(AppStoreConnect);

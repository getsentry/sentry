import {Fragment, useContext, useState} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import List from 'app/components/list';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import withApi from 'app/utils/withApi';
import AppStoreConnectContext from 'app/views/settings/project/appStoreConnectContext';

import Accordion from './accordion';
import AppStoreCredentials from './appStoreCredentials';
import ItunesCredentials from './itunesCredentials';
import {AppStoreCredentialsData, ItunesCredentialsData} from './types';

type IntialData = {
  appId: string;
  appName: string;
  appconnectIssuer: string;
  appconnectKey: string;
  encrypted: string;
  id: string;
  itunesUser: string;
  name: string;
  orgId: number;
  orgName: string;
  type: string;
};

type Props = Pick<ModalRenderProps, 'Body' | 'Footer' | 'closeModal'> & {
  api: Client;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
  onSubmit: (data: Record<string, any>) => void;
  initialData?: IntialData;
};

function AppStoreConnect({
  Body,
  Footer,
  closeModal,
  api,
  initialData,
  orgSlug,
  projectSlug,
  onSubmit,
}: Props) {
  const appStoreConnectContext = useContext(AppStoreConnectContext);

  const [isLoading, setIsLoading] = useState(false);

  const appStoreCredentialsInitialData = {
    issuer: initialData?.appconnectIssuer,
    keyId: initialData?.appconnectKey,
    privateKey: undefined,
    app:
      initialData?.appName && initialData?.appId
        ? {
            appId: initialData.appId,
            name: initialData.appName,
          }
        : undefined,
  };

  const iTunesCredentialsInitialData = {
    username: initialData?.itunesUser,
    password: undefined,
    authenticationCode: undefined,
    org:
      initialData?.orgId && initialData?.orgName
        ? {
            organizationId: initialData.orgId,
            name: initialData.appName,
          }
        : undefined,
    useSms: undefined,
    sessionContext: undefined,
  };

  const [
    appStoreCredentialsData,
    setAppStoreCredentialsData,
  ] = useState<AppStoreCredentialsData>(appStoreCredentialsInitialData);

  const [
    iTunesCredentialsData,
    setItunesCredentialsData,
  ] = useState<ItunesCredentialsData>(iTunesCredentialsInitialData);

  async function handleSave() {
    let endpoint = `/projects/${orgSlug}/${projectSlug}/appstoreconnect/`;
    let successMessage = t('App Store Connect repository was successfully added');
    let errorMessage = t(
      'An error occured while adding the App Store Connect repository'
    );

    if (!!initialData) {
      endpoint = `${endpoint}${initialData.id}/`;
      successMessage = t('App Store Connect repository was successfully updated');
      errorMessage = t(
        'An error occured while updating the App Store Connect repository'
      );
    }

    setIsLoading(true);
    try {
      const response = await api.requestPromise(endpoint, {
        method: 'POST',
        data: {
          appconnectIssuer: appStoreCredentialsData.issuer,
          appconnectKey: appStoreCredentialsData.keyId,
          appconnectPrivateKey: appStoreCredentialsData.privateKey,
          appName: appStoreCredentialsData.app?.name,
          appId: appStoreCredentialsData.app?.appId,
          itunesUser: iTunesCredentialsData.username,
          itunesPassword: iTunesCredentialsData.password,
          orgId: iTunesCredentialsData.org?.organizationId,
          orgName: iTunesCredentialsData.org?.name,
          sessionContext: iTunesCredentialsData.sessionContext,
        },
      });
      addSuccessMessage(successMessage);
      setIsLoading(false);
      onSubmit(response);
      closeModal();
    } catch {
      setIsLoading(false);
      addErrorMessage(errorMessage);
    }
  }

  const isUpdating = !!initialData;

  function isDataInvalid(data: Record<string, any>) {
    return Object.keys(data).some(key => {
      const value = data[key];

      if (typeof value === 'string') {
        return !value.trim();
      }

      return typeof value === 'undefined';
    });
  }

  function isAppStoreCredentialsDataInvalid() {
    return isDataInvalid(appStoreCredentialsData);
  }

  function isItunesCredentialsDataInvalid() {
    return isDataInvalid(iTunesCredentialsData);
  }

  function isFormInvalid() {
    if (!!initialData) {
      const isAppStoreCredentialsDataTheSame = isEqual(
        appStoreCredentialsData,
        appStoreCredentialsInitialData
      );

      const isItunesCredentialsDataTheSame = isEqual(
        iTunesCredentialsData,
        iTunesCredentialsInitialData
      );

      if (!isAppStoreCredentialsDataTheSame && !isItunesCredentialsDataTheSame) {
        return isAppStoreCredentialsDataInvalid() && isItunesCredentialsDataInvalid();
      }

      if (!isAppStoreCredentialsDataTheSame) {
        return isAppStoreCredentialsDataInvalid();
      }

      if (!isItunesCredentialsDataTheSame) {
        return isItunesCredentialsDataInvalid();
      }

      return isAppStoreCredentialsDataTheSame && isItunesCredentialsDataTheSame;
    }

    return isAppStoreCredentialsDataInvalid() && isItunesCredentialsDataInvalid();
  }

  return (
    <Fragment>
      <Body>
        <StyledList symbol="colored-numeric">
          <Accordion
            summary={t('App Store Connect credentials')}
            defaultExpanded={
              !isUpdating || !!appStoreConnectContext?.appstoreCredentialsValid
            }
          >
            {!!appStoreConnectContext?.appstoreCredentialsValid && (
              <StyledAlert type="warning" icon={<IconWarning />}>
                {t(
                  'Your App Store Connect credentials are invalid. To reconnect, update your credentials'
                )}
              </StyledAlert>
            )}
            <AppStoreCredentials
              api={api}
              orgSlug={orgSlug}
              projectSlug={projectSlug}
              data={appStoreCredentialsData}
              onChange={setAppStoreCredentialsData}
              onReset={() => setAppStoreCredentialsData(appStoreCredentialsInitialData)}
              isUpdating={isUpdating}
            />
          </Accordion>
          <Accordion
            summary={t('iTunes credentials')}
            defaultExpanded={!!appStoreConnectContext?.itunesSessionValid}
          >
            {!!appStoreConnectContext?.itunesSessionValid && (
              <StyledAlert type="warning" icon={<IconWarning />}>
                {t(
                  'Your iTunes session has expired. To reconnect, sign in with your Apple ID and password'
                )}
              </StyledAlert>
            )}
            <ItunesCredentials
              api={api}
              orgSlug={orgSlug}
              projectSlug={projectSlug}
              data={iTunesCredentialsData}
              onChange={setItunesCredentialsData}
              onReset={() => setItunesCredentialsData(iTunesCredentialsInitialData)}
              isUpdating={isUpdating}
            />
          </Accordion>
        </StyledList>
      </Body>
      <Footer>
        <ButtonBar gap={1.5}>
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <StyledButton
            priority="primary"
            onClick={handleSave}
            disabled={isFormInvalid() || isLoading}
          >
            {t('Save')}
          </StyledButton>
        </ButtonBar>
      </Footer>
    </Fragment>
  );
}

export default withApi(AppStoreConnect);

const StyledList = styled(List)`
  grid-gap: ${space(2)};
  & > li {
    padding-left: 0;
    :before {
      z-index: 1;
      left: 9px;
      top: ${space(1.5)};
    }
  }
`;

const StyledButton = styled(Button)`
  position: relative;
`;

const StyledAlert = styled(Alert)`
  margin: ${space(1)} 0 ${space(2)} 0;
`;

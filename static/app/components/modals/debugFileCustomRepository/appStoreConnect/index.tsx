import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import List from 'app/components/list';
import {IconInfo, IconWarning} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {AppStoreConnectValidationData} from 'app/types/debugFiles';
import withApi from 'app/utils/withApi';

import Accordion from './accordion';
import AppStoreCredentials from './appStoreCredentials';
import ItunesCredentials from './itunesCredentials';
import {AppStoreCredentialsData, ItunesCredentialsData} from './types';

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

type Props = Pick<ModalRenderProps, 'Body' | 'Footer' | 'closeModal'> & {
  api: Client;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
  onSubmit: (data: Record<string, any>) => void;
  revalidateItunesSession: boolean;
  appStoreConnectValidationData?: AppStoreConnectValidationData;
  initialData?: InitialData;
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
  revalidateItunesSession,
  appStoreConnectValidationData,
}: Props) {
  const isUpdating = !!initialData;
  const appStoreCredentialsInvalid =
    appStoreConnectValidationData?.appstoreCredentialsValid === false;
  const itunesSessionInvalid =
    appStoreConnectValidationData?.itunesSessionValid === false;

  const [isLoading, setIsLoading] = useState(false);
  const [isEditingAppStoreCredentials, setIsEditingAppStoreCredentials] = useState(
    appStoreCredentialsInvalid
  );
  const [isEditingItunesCredentials, setIsEditingItunesCredentials] = useState(
    itunesSessionInvalid
  );

  const appStoreCredentialsInitialData = {
    issuer: initialData?.appconnectIssuer,
    keyId: initialData?.appconnectKey,
    privateKey: initialData?.appconnectPrivateKey,
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
    password: initialData?.itunesPassword,
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

  function handleEditAppStoreCredentials(isEditing: boolean) {
    setIsEditingAppStoreCredentials(isEditing);

    if (
      !isEditing &&
      isEditingAppStoreCredentials &&
      isAppStoreCredentialsDataInvalid()
    ) {
      setIsEditingItunesCredentials(true);
    }
  }

  return (
    <Fragment>
      <Body>
        {revalidateItunesSession && !itunesSessionInvalid && (
          <StyledAlert type="warning" icon={<IconInfo />}>
            {t('Your iTunes session has already been re-validated.')}
          </StyledAlert>
        )}
        <StyledList symbol="colored-numeric">
          <Accordion summary={t('App Store Connect credentials')} defaultExpanded>
            {appStoreCredentialsInvalid && (
              <StyledAlert type="warning" icon={<IconWarning />}>
                {t(
                  'Your App Store Connect credentials are invalid. To reconnect, update your credentials.'
                )}
              </StyledAlert>
            )}
            <AppStoreCredentials
              api={api}
              orgSlug={orgSlug}
              projectSlug={projectSlug}
              data={appStoreCredentialsData}
              isUpdating={isUpdating}
              isEditing={isEditingAppStoreCredentials}
              onChange={setAppStoreCredentialsData}
              onReset={() => setAppStoreCredentialsData(appStoreCredentialsInitialData)}
              onEdit={handleEditAppStoreCredentials}
            />
          </Accordion>
          <Accordion
            summary={t('iTunes credentials')}
            defaultExpanded={
              itunesSessionInvalid ||
              isUpdating ||
              isEditingItunesCredentials ||
              (!isEditingItunesCredentials && !isItunesCredentialsDataInvalid())
            }
          >
            {!revalidateItunesSession && itunesSessionInvalid && (
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
              isUpdating={isUpdating}
              isEditing={isEditingItunesCredentials}
              revalidateItunesSession={revalidateItunesSession && itunesSessionInvalid}
              onChange={setItunesCredentialsData}
              onReset={() => setItunesCredentialsData(iTunesCredentialsInitialData)}
              onEdit={setIsEditingItunesCredentials}
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

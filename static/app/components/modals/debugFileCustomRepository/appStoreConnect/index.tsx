import {Fragment, useContext, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import {Panel} from 'app/components/panels';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import withApi from 'app/utils/withApi';
import AppStoreConnectContext from 'app/views/settings/project/appStoreConnectContext';

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
  const appStoreConnenctContext = useContext(AppStoreConnectContext);

  const [isLoading, setIsLoading] = useState(false);

  const [
    appStoreCredentialsData,
    setAppStoreCredentialsData,
  ] = useState<AppStoreCredentialsData>({
    issuer: initialData?.appconnectIssuer,
    keyId: initialData?.appconnectKey,
    privateKey: undefined,
    app: undefined,
  });

  const [
    itunesCredentialsData,
    setItunesCredentialsData,
  ] = useState<ItunesCredentialsData>({
    username: initialData?.itunesUser,
    password: undefined,
    authenticationCode: undefined,
    org: undefined,
    useSms: undefined,
    sessionContext: undefined,
  });

  async function handleSave() {
    if (!itunesCredentialsData.org || !appStoreCredentialsData.app) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.requestPromise(
        `/projects/${orgSlug}/${projectSlug}/appstoreconnect/`,
        {
          method: 'POST',
          data: {
            appconnectIssuer: appStoreCredentialsData.issuer,
            appconnectKey: appStoreCredentialsData.keyId,
            appconnectPrivateKey: appStoreCredentialsData.privateKey,
            appName: appStoreCredentialsData.app.name,
            appId: appStoreCredentialsData.app.appId,
            itunesUser: itunesCredentialsData.username,
            itunesPassword: itunesCredentialsData.password,
            orgId: itunesCredentialsData.org.organizationId,
            orgName: itunesCredentialsData.org.name,
            sessionContext: itunesCredentialsData.sessionContext,
          },
        }
      );
      addSuccessMessage('App Store Connect repository was successfully added');
      onSubmit(response);
      closeModal();
    } catch {
      setIsLoading(false);
      addErrorMessage(t('An error occured while saving the repository'));
    }
  }

  function isFormInvalid() {
    const generalData = {...appStoreCredentialsData, ...itunesCredentialsData};
    return Object.keys(generalData).some(key => {
      const value = generalData[key];

      if (typeof value === 'string') {
        return !value.trim();
      }

      return typeof value === 'undefined';
    });
  }

  const isUpdating = !!initialData;

  return (
    <Fragment>
      <Body>
        <StyledList symbol="colored-numeric">
          <ListItem>
            <ItemTitle>{t('App Store Connect credentials')}</ItemTitle>
            {!!appStoreConnenctContext?.appstoreCredentialsValid && (
              <StyledAlert type="warning" icon={<IconWarning />}>
                {t(
                  'Your App Store Connect credentials are invalid. To reconnect, update your credentials'
                )}
              </StyledAlert>
            )}
            <ItemContent>
              <AppStoreCredentials
                api={api}
                orgSlug={orgSlug}
                projectSlug={projectSlug}
                data={appStoreCredentialsData}
                onChange={setAppStoreCredentialsData}
                isUpdating={isUpdating}
              />
            </ItemContent>
          </ListItem>
          <ListItem>
            <ItemTitle>{t('iTunes credentials')}</ItemTitle>
            {!!appStoreConnenctContext?.itunesSessionValid && (
              <StyledAlert type="warning" icon={<IconWarning />}>
                {t(
                  'Your iTunes session has expired. To reconnect, sign in with your Apple ID and password'
                )}
              </StyledAlert>
            )}
            <ItemContent>
              <ItunesCredentials
                api={api}
                orgSlug={orgSlug}
                projectSlug={projectSlug}
                data={itunesCredentialsData}
                onChange={setItunesCredentialsData}
                isUpdating={isUpdating}
              />
            </ItemContent>
          </ListItem>
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
  grid-gap: 0;
  & > li {
    padding-left: 0;
    display: grid;
    grid-gap: ${space(1)};
  }
`;

const ItemTitle = styled('div')`
  padding-left: ${space(4)};
  margin-bottom: ${space(1)};
`;

const ItemContent = styled(Panel)`
  padding: ${space(3)} ${space(3)} ${space(2)} ${space(1)};
`;

const StyledButton = styled(Button)`
  position: relative;
`;

const StyledAlert = styled(Alert)`
  margin-bottom: ${space(1)};
`;

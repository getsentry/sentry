import {useContext, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import moment from 'moment';

import {promptsCheck, promptsUpdate} from 'app/actionCreators/prompts';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import Link from 'app/components/links/link';
import {IconClose, IconRefresh} from 'app/icons';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {AppStoreConnectValidationData} from 'app/types/debugFiles';
import {promptIsDismissed} from 'app/utils/promptIsDismissed';
import withApi from 'app/utils/withApi';
import AppStoreConnectContext from 'app/views/settings/project/appStoreConnectContext';

const APP_STORE_CONNECT_UPDATES = 'app_store_connect_updates';

type Props = {
  api: Client;
  organization: Organization;
  project?: Project;
  Wrapper?: React.ComponentType;
  isCompact?: boolean;
  className?: string;
};

function UpdateAlert({api, Wrapper, isCompact, project, organization, className}: Props) {
  const appStoreConnectContext = useContext(AppStoreConnectContext);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    checkPrompt();
  }, []);

  async function checkPrompt() {
    if (!project) {
      return;
    }

    const prompt = await promptsCheck(api, {
      organizationId: organization.id,
      projectId: project.id,
      feature: APP_STORE_CONNECT_UPDATES,
    });

    setIsDismissed(promptIsDismissed(prompt));
  }

  function handleDismiss() {
    if (!project) {
      return;
    }

    promptsUpdate(api, {
      organizationId: organization.id,
      projectId: project.id,
      feature: APP_STORE_CONNECT_UPDATES,
      status: 'dismissed',
    });

    setIsDismissed(true);
  }

  function renderMessage(
    appConnectValidationData: AppStoreConnectValidationData,
    projectSettingsLink: string
  ) {
    const commonMessage = isCompact ? (
      <Link to={projectSettingsLink}>
        {t('Update your session in the project settings to reconnect.')}
      </Link>
    ) : (
      t('Update your session in the project settings to reconnect.')
    );

    if (
      !appConnectValidationData.itunesSessionValid ||
      !appConnectValidationData.appstoreCredentialsValid
    ) {
      return (
        <span>
          {t('Your App Store Connect session has expired. ')}
          {commonMessage}
        </span>
      );
    }

    const now = moment();
    const expirationDate = moment(appConnectValidationData.expirationDate);
    const daysLeftForTheITunesSessionToExpire = expirationDate.diff(now, 'days');

    if (daysLeftForTheITunesSessionToExpire === 0) {
      return (
        <span>
          {t('Your App Store Connect session expires today. ')}
          {commonMessage}
        </span>
      );
    }

    if (daysLeftForTheITunesSessionToExpire === 1) {
      return (
        <span>
          {t('Your App Store Connect session will expire tomorrow. ')}
          {commonMessage}
        </span>
      );
    }

    return (
      <span>
        {tct('Your App Store Connect session will expire in [days] days. ', {
          days: daysLeftForTheITunesSessionToExpire,
        })}
        {commonMessage}
      </span>
    );
  }

  function renderActions(projectSettingsLink: string) {
    if (isCompact) {
      return (
        <ButtonClose
          priority="link"
          title={t('Dismiss')}
          label={t('Dismiss')}
          onClick={handleDismiss}
          icon={<IconClose />}
        />
      );
    }

    return (
      <Actions>
        <Button priority="link" onClick={handleDismiss}>
          {t('Dismiss')}
        </Button>
        |
        <Button priority="link" to={projectSettingsLink}>
          {t('Review updates')}
        </Button>
      </Actions>
    );
  }

  const hasAppConnectStoreFeatureFlag = !!organization.features?.includes(
    'app-store-connect'
  );

  if (
    !hasAppConnectStoreFeatureFlag ||
    !project ||
    !appStoreConnectContext ||
    isDismissed ||
    (appStoreConnectContext.appstoreCredentialsValid &&
      appStoreConnectContext.itunesSessionValid)
  ) {
    return null;
  }

  const projectSettingsLink = `/settings/${organization.slug}/projects/${project.slug}/`;

  const notice = (
    <Alert type="warning" icon={<IconRefresh />} className={className}>
      <Content>
        {renderMessage(appStoreConnectContext, projectSettingsLink)}
        {renderActions(projectSettingsLink)}
      </Content>
    </Alert>
  );

  return Wrapper ? <Wrapper>{notice}</Wrapper> : notice;
}

export default withApi(UpdateAlert);

const Actions = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, max-content);
  grid-gap: ${space(1)};
`;

const Content = styled('div')`
  display: flex;
  flex-wrap: wrap;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    justify-content: space-between;
  }
`;

const ButtonClose = styled(Button)`
  color: ${p => p.theme.textColor};
`;

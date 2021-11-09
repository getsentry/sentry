import {Fragment, useContext, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import find from 'lodash/find';
import mapValues from 'lodash/mapValues';

import {Client} from 'app/api';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import Link from 'app/components/links/link';
import AppStoreConnectContext from 'app/components/projects/appStoreConnectContext';
import {IconClose, IconRefresh} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {AppStoreConnectStatusData} from 'app/types/debugFiles';
import {promptIsDismissed} from 'app/utils/promptIsDismissed';
import withApi from 'app/utils/withApi';

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
  const [firstError, setFirstError] = useState(
    find(appStoreConnectContext, source => source.credentials.status === 'invalid')
  );

  useEffect(() => {
    setFirstError(
      find(appStoreConnectContext, source => source.credentials.status === 'invalid')
    );
  }, [appStoreConnectContext]);

  useEffect(() => {
    checkPrompt();
  }, [appStoreConnectContext, firstError]);

  async function checkPrompt() {
    if (!project || !appStoreConnectContext || !firstError || isDismissed) {
      return;
    }

    const allPrompts = await promptsCheck(api, {
      organizationId: organization.id,
      projectId: project.id,
      feature: APP_STORE_CONNECT_UPDATES,
    });

    const prompt = allPrompts?.[firstError.id];

    if (!prompt) {
      return;
    }

    setIsDismissed(promptIsDismissed(prompt, 1));
  }

  const handleDismiss = (sourceId: string) => () => {
    if (!project) {
      return;
    }

    promptsUpdate(api, {
      organizationId: organization.id,
      projectId: project.id,
      feature: APP_STORE_CONNECT_UPDATES,
      sourceId,
      status: 'snoozed',
    });

    setIsDismissed(true);
  };

  function renderMessage(
    appStoreConnectStatusData: AppStoreConnectStatusData,
    projectSettingsLink: string
  ) {
    if (!appStoreConnectStatusData.updateAlertMessage) {
      return null;
    }

    const {updateAlertMessage} = appStoreConnectStatusData;

    return (
      <div>
        {updateAlertMessage}
        {isCompact && (
          <Fragment>
            &nbsp;
            <Link to={projectSettingsLink}>
              {t('Update it in the project settings to reconnect')}
            </Link>
          </Fragment>
        )}
      </div>
    );
  }

  function renderActions(sourceId: string, projectSettingsLink: string) {
    if (isCompact) {
      return (
        <ButtonClose
          priority="link"
          title={t('Dismiss')}
          label={t('Dismiss')}
          onClick={handleDismiss(sourceId)}
          icon={<IconClose />}
        />
      );
    }

    return (
      <Actions>
        <Button priority="link" onClick={handleDismiss(sourceId)}>
          {t('Dismiss')}
        </Button>
        |
        <Button priority="link" to={projectSettingsLink}>
          {t('Update session')}
        </Button>
      </Actions>
    );
  }

  if (!project || !firstError || isDismissed) {
    return null;
  }

  const projectSettingsLink = `/settings/${organization.slug}/projects/${project.slug}/debug-symbols/?customRepository=${firstError.id}`;

  const notice = (
    <Alert type="warning" icon={<IconRefresh />} className={className}>
      <Content>
        {renderMessage(firstError, projectSettingsLink)}
        {renderActions(firstError.id, projectSettingsLink)}
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
  align-items: center;
`;

const Content = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  grid-gap: ${space(1)};
`;

const ButtonClose = styled(Button)`
  color: ${p => p.theme.textColor};
  /* Give the button an explicit height so that it lines up with the icon */
  height: 22px;
`;

/**
 * Incredibly cursed multi prompt custom code zone
 */

type AppStoreConnectPromptsUpdateParams = {
  /**
   * The numeric organization ID as a string
   */
  organizationId: string;
  /**
   * The numeric project ID as a string
   */
  projectId: string;
  /**
   * The prompt feature name
   */
  feature: string;
  /**
   * The source ID
   */
  sourceId: string;
  status: 'snoozed' | 'dismissed';
};

/**
 * Update the status of an ASC prompt
 */
function promptsUpdate(api: Client, params: AppStoreConnectPromptsUpdateParams) {
  return api.requestPromise('/app-store-connect-prompts-activity/', {
    method: 'PUT',
    data: {
      organization_id: params.organizationId,
      project_id: params.projectId,
      feature: params.feature,
      source_id: params.sourceId,
      status: params.status,
    },
  });
}

type AppStoreConnectPromptCheckParams = {
  /**
   * The numeric organization ID as a string
   */
  organizationId: string;
  /**
   * The numeric project ID as a string
   */
  projectId?: string;
  /**
   * The prompt feature name
   */
  feature: string;
};

type PromptResponseItem = Record<
  string,
  {
    snoozed_ts?: number;
    dismissed_ts?: number;
  }
>;
type PromptResponse = {
  data?: PromptResponseItem;
};

type PromptData = null | Record<
  string,
  {
    dismissedTime?: number;
    snoozedTime?: number;
  }
>;

/**
 * Get the status of ASC prompts
 */
export async function promptsCheck(
  api: Client,
  params: AppStoreConnectPromptCheckParams
): Promise<PromptData> {
  const query = {
    feature: params.feature,
    organization_id: params.organizationId,
    ...(params.projectId === undefined ? {} : {project_id: params.projectId}),
  };

  const response: PromptResponse = await api.requestPromise(
    '/app-store-connect-prompts-activity/',
    {
      query,
    }
  );

  const data = response?.data;

  if (!data) {
    return null;
  }

  return mapValues(data, prompt => ({
    dismissedTime: prompt.dismissed_ts,
    snoozedTime: prompt.snoozed_ts,
  }));
}

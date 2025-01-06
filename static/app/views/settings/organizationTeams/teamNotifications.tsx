import {Fragment} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import EmptyMessage from 'sentry/components/emptyMessage';
import TextField from 'sentry/components/forms/fields/textField';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {Tooltip} from 'sentry/components/tooltip';
import {IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ExternalTeam, Integration} from 'sentry/types/integrations';
import type {Team} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import PermissionAlert from 'sentry/views/settings/project/permissionAlert';

const DOCS_LINK =
  'https://docs.sentry.io/product/integrations/notification-incidents/slack/#team-notifications';
const NOTIFICATION_PROVIDERS = ['slack'];

function TeamNotificationSettingsPanel({
  team,
  integrations,
  onDelete,
}: {
  integrations: Integration[];
  onDelete: (externalTeam: ExternalTeam) => void;
  team: Team;
}) {
  const organization = useOrganization();

  const notificationIntegrations = integrations.filter(integration =>
    NOTIFICATION_PROVIDERS.includes(integration.provider.key)
  );
  if (!notificationIntegrations.length) {
    return (
      <EmptyMessage>
        {t('No Notification Integrations have been installed yet.')}
      </EmptyMessage>
    );
  }

  const externalTeams = (team.externalTeams ?? []).filter(externalTeam =>
    NOTIFICATION_PROVIDERS.includes(externalTeam.provider)
  );

  if (!externalTeams.length) {
    return (
      <EmptyMessage>
        <div>{t('No teams have been linked yet.')}</div>
        <NotDisabledSubText>
          {tct('Head over to Slack and type [code] to get started. [link].', {
            code: <code>/sentry link team</code>,
            link: <ExternalLink href={DOCS_LINK}>{t('Learn more')}</ExternalLink>,
          })}
        </NotDisabledSubText>
      </EmptyMessage>
    );
  }

  const integrationsById = Object.fromEntries(
    notificationIntegrations.map(integration => [integration.id, integration])
  );

  const hasWriteAccess = hasEveryAccess(['team:write'], {organization, team});

  return externalTeams.map(externalTeam => (
    <FormFieldWrapper key={externalTeam.id}>
      <StyledFormField
        disabled
        label={
          <div>
            <NotDisabledText>
              {toTitleCase(externalTeam.provider)}:
              {integrationsById[externalTeam.integrationId]!.name}
            </NotDisabledText>
            <NotDisabledSubText>
              {tct('Unlink this channel in Slack with [code]. [link].', {
                code: <code>/sentry unlink team</code>,
                link: <ExternalLink href={DOCS_LINK}>{t('Learn more')}</ExternalLink>,
              })}
            </NotDisabledSubText>
          </div>
        }
        labelText={t('Unlink this channel in slack with `/slack unlink team`')}
        name="externalName"
        value={externalTeam.externalName}
      />

      <DeleteButtonWrapper>
        <Tooltip
          title={t(
            'You must be an organization owner, manager or admin to remove a Slack team link'
          )}
          disabled={hasWriteAccess}
        >
          <Confirm
            disabled={!hasWriteAccess}
            onConfirm={() => onDelete(externalTeam)}
            message={t('Are you sure you want to remove this Slack team link?')}
          >
            <Button icon={<IconDelete />} disabled={!hasWriteAccess}>
              {t('Unlink')}
            </Button>
          </Confirm>
        </Tooltip>
      </DeleteButtonWrapper>
    </FormFieldWrapper>
  ));
}

function TeamNotificationSettings() {
  const api = useApi();
  const params = useParams<{teamId: string}>();
  const organization = useOrganization();

  const {
    data: team,
    isPending: isTeamPending,
    isError: isTeamError,
    refetch: refetchTeam,
  } = useApiQuery<Team>(
    [
      `/teams/${organization.slug}/${params.teamId}/`,
      {
        query: {expand: ['externalTeams']},
      },
    ],
    {
      staleTime: 0,
    }
  );

  const {
    data: integrations,
    isPending: isIntegrationsPending,
    isError: isIntegrationsError,
    refetch: refetchIntegrations,
  } = useApiQuery<Integration[]>(
    [
      `/organizations/${organization.slug}/integrations/`,
      {
        query: {includeConfig: '0'},
      },
    ],
    {
      staleTime: 0,
    }
  );

  if (isTeamPending || isIntegrationsPending) {
    return <LoadingIndicator />;
  }

  if (isTeamError || isIntegrationsError) {
    return (
      <LoadingError
        onRetry={() => {
          refetchTeam();
          refetchIntegrations();
        }}
      />
    );
  }

  const handleDelete = async (externalTeam: ExternalTeam) => {
    try {
      await api.requestPromise(
        `/teams/${organization.slug}/${team.slug}/external-teams/${externalTeam.id}/`,
        {
          method: 'DELETE',
        }
      );
      addSuccessMessage(t('Deletion successful'));
    } catch {
      addErrorMessage(t('An error occurred'));
    }

    refetchTeam();
    refetchIntegrations();
  };

  return (
    <Fragment>
      <SentryDocumentTitle
        title={t('%s Team Notification Settings', `#${params.teamId}`)}
      />
      <PermissionAlert access={['team:write']} team={team} />
      <Panel>
        <PanelHeader>{t('Notifications')}</PanelHeader>
        <PanelBody>
          <TeamNotificationSettingsPanel
            team={team}
            integrations={integrations}
            onDelete={handleDelete}
          />
        </PanelBody>
      </Panel>
    </Fragment>
  );
}

export default TeamNotificationSettings;

const NotDisabledText = styled('div')`
  color: ${p => p.theme.textColor};
  line-height: ${space(2)};
`;
const NotDisabledSubText = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeRelativeSmall};
  line-height: 1.4;
  margin-top: ${space(1)};
`;
const FormFieldWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-start;
`;
const StyledFormField = styled(TextField)`
  flex: 1;
`;
const DeleteButtonWrapper = styled('div')`
  margin-right: ${space(2)};
`;

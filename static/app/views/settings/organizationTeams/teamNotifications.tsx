import {Fragment} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import type DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import EmptyMessage from 'sentry/components/emptyMessage';
import TextField from 'sentry/components/forms/fields/textField';
import ExternalLink from 'sentry/components/links/externalLink';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {Tooltip} from 'sentry/components/tooltip';
import {IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ExternalTeam, Integration} from 'sentry/types/integrations';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization, Team} from 'sentry/types/organization';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import withOrganization from 'sentry/utils/withOrganization';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';
import PermissionAlert from 'sentry/views/settings/project/permissionAlert';

type Props = RouteComponentProps<{teamId: string}, {}> & {
  organization: Organization;
  team: Team;
};

type State = DeprecatedAsyncView['state'] & {
  integrations: Integration[];
  teamDetails: Team;
};

const DOCS_LINK =
  'https://docs.sentry.io/product/integrations/notification-incidents/slack/#team-notifications';
const NOTIFICATION_PROVIDERS = ['slack'];

class TeamNotificationSettings extends DeprecatedAsyncView<Props, State> {
  getTitle() {
    return 'Team Notification Settings';
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {organization, team} = this.props;
    return [
      [
        'teamDetails',
        `/teams/${organization.slug}/${team.slug}/`,
        {query: {expand: ['externalTeams']}},
      ],
      [
        'integrations',
        `/organizations/${organization.slug}/integrations/`,
        {query: {includeConfig: 0}},
      ],
    ];
  }

  handleDelete = async (mapping: ExternalTeam) => {
    try {
      const {organization, team} = this.props;
      const endpoint = `/teams/${organization.slug}/${team.slug}/external-teams/${mapping.id}/`;
      await this.api.requestPromise(endpoint, {
        method: 'DELETE',
      });
      addSuccessMessage(t('Deletion successful'));
      this.fetchData();
    } catch {
      addErrorMessage(t('An error occurred'));
    }
  };

  renderBody() {
    const {team} = this.props;
    return (
      <Fragment>
        <PermissionAlert access={['team:write']} team={team} />

        <Panel>
          <PanelHeader>{t('Notifications')}</PanelHeader>
          <PanelBody>{this.renderPanelBody()}</PanelBody>
        </Panel>
      </Fragment>
    );
  }

  renderPanelBody() {
    const {organization, team} = this.props;
    const {teamDetails, integrations} = this.state;

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

    const externalTeams = (teamDetails.externalTeams || []).filter(externalTeam =>
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
              onConfirm={() => this.handleDelete(externalTeam)}
              message={t('Are you sure you want to remove this Slack team link?')}
            >
              <Button
                size="sm"
                icon={<IconDelete size="md" />}
                aria-label={t('delete')}
                disabled={!hasWriteAccess}
              />
            </Confirm>
          </Tooltip>
        </DeleteButtonWrapper>
      </FormFieldWrapper>
    ));
  }
}
export default withOrganization(TeamNotificationSettings);

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
  margin-right: ${space(4)};
  padding-right: ${space(0.5)};
`;

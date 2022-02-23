import * as React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import AsyncComponent from 'sentry/components/asyncComponent';
import Button from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import TextField from 'sentry/components/forms/textField';
import ExternalLink from 'sentry/components/links/externalLink';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import Tooltip from 'sentry/components/tooltip';
import {IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {ExternalTeam, Integration, Organization, Team} from 'sentry/types';
import {toTitleCase} from 'sentry/utils';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';

type Props = RouteComponentProps<{orgId: string; teamId: string}, {}> & {
  organization: Organization;
  team: Team;
};

type State = AsyncView['state'] & {
  integrations: Integration[];
  teamDetails: Team;
};

const DOCS_LINK =
  'https://docs.sentry.io/product/integrations/notification-incidents/slack/#team-notifications';
const NOTIFICATION_PROVIDERS = ['slack'];

class TeamNotificationSettings extends AsyncView<Props, State> {
  getTitle() {
    return 'Team Notification Settings';
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
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
    return (
      <Panel>
        <PanelHeader>{t('Notifications')}</PanelHeader>
        <PanelBody>{this.renderPanelBody()}</PanelBody>
      </Panel>
    );
  }

  renderPanelBody() {
    const {organization} = this.props;
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

    const access = new Set(organization.access);
    const hasAccess = access.has('team:write');

    return externalTeams.map(externalTeam => (
      <FormFieldWrapper key={externalTeam.id}>
        <StyledFormField
          disabled
          label={
            <div>
              <NotDisabledText>
                {toTitleCase(externalTeam.provider)}:
                {integrationsById[externalTeam.integrationId].name}
              </NotDisabledText>
              <NotDisabledSubText>
                {tct('Unlink this channel in Slack with [code]. [link].', {
                  code: <code>/sentry unlink team</code>,
                  link: <ExternalLink href={DOCS_LINK}>{t('Learn more')}</ExternalLink>,
                })}
              </NotDisabledSubText>
            </div>
          }
          name="externalName"
          value={externalTeam.externalName}
        />
        <DeleteButtonWrapper>
          <Tooltip
            title={t(
              'You must be an organization owner, manager or admin to remove a Slack team link'
            )}
            disabled={hasAccess}
          >
            <Confirm
              disabled={!hasAccess}
              onConfirm={() => this.handleDelete(externalTeam)}
              message={t('Are you sure you want to remove this Slack team link?')}
            >
              <Button
                size="small"
                icon={<IconDelete size="md" />}
                aria-label={t('delete')}
                disabled={!hasAccess}
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

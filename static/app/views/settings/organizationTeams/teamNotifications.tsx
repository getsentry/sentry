import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import AsyncComponent from 'app/components/asyncComponent';
import ExternalLink from 'app/components/links/externalLink';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Integration, LightWeightOrganization, Team} from 'app/types';
import {toTitleCase} from 'app/utils';
import withOrganization from 'app/utils/withOrganization';
import AsyncView from 'app/views/asyncView';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import TextField from 'app/views/settings/components/forms/textField';

type Props = RouteComponentProps<{orgId: string; teamId: string}, {}> & {
  organization: LightWeightOrganization;
  team: Team;
};

type State = AsyncView['state'] & {
  teamDetails: Team;
  integrations: Integration[];
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

  renderBody() {
    return (
      <Panel>
        <PanelHeader>{t('Notifications')}</PanelHeader>
        <PanelBody>{this.renderPanelBody()}</PanelBody>
      </Panel>
    );
  }

  renderPanelBody() {
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

    return externalTeams.map(externalTeam => (
      <TextField
        disabled
        key={externalTeam.id}
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

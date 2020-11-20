import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';

import {openCreateTeamModal} from 'app/actionCreators/modal';
import Button from 'app/components/button';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {IconAdd} from 'app/icons';
import {t} from 'app/locale';
import {Organization, Team} from 'app/types';
import recreateRoute from 'app/utils/recreateRoute';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';

import AllTeamsList from './allTeamsList';

type Props = {
  access: Set<string>;
  features: Set<string>;
  allTeams: Team[];
  activeTeams: Team[];
  organization: Organization;
} & RouteComponentProps<{orgId: string}, {}>;

function OrganizationTeams({
  allTeams,
  activeTeams,
  organization,
  access,
  features,
  routes,
  params,
}: Props) {
  if (!organization) {
    return null;
  }
  const canCreateTeams = access.has('project:admin');

  const action = (
    <Button
      priority="primary"
      size="small"
      disabled={!canCreateTeams}
      title={
        !canCreateTeams ? t('You do not have permission to create teams') : undefined
      }
      onClick={() =>
        openCreateTeamModal({
          organization,
        })
      }
      icon={<IconAdd size="xs" isCircled />}
    >
      {t('Create Team')}
    </Button>
  );

  const teamRoute = routes.find(({path}) => path === 'teams/');
  const urlPrefix = teamRoute
    ? recreateRoute(teamRoute, {routes, params, stepBack: -2})
    : '';

  const activeTeamIds = new Set(activeTeams.map(team => team.id));
  const otherTeams = allTeams.filter(team => !activeTeamIds.has(team.id));
  const title = t('Teams');

  return (
    <div data-test-id="team-list">
      <SentryDocumentTitle title={title} objSlug={organization.slug} />
      <SettingsPageHeader title={title} action={action} />
      <Panel>
        <PanelHeader>{t('Your Teams')}</PanelHeader>
        <PanelBody>
          <AllTeamsList
            urlPrefix={urlPrefix}
            organization={organization}
            teamList={activeTeams}
            access={access}
            openMembership={false}
          />
        </PanelBody>
      </Panel>
      <Panel>
        <PanelHeader>{t('Other Teams')}</PanelHeader>
        <PanelBody>
          <AllTeamsList
            urlPrefix={urlPrefix}
            organization={organization}
            teamList={otherTeams}
            access={access}
            openMembership={
              !!(features.has('open-membership') || access.has('org:write'))
            }
          />
        </PanelBody>
      </Panel>
    </div>
  );
}

export default OrganizationTeams;

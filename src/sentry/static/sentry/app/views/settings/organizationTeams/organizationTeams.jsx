import PropTypes from 'prop-types';
import React from 'react';

import {getOrganizationState} from 'app/mixins/organizationState';
import {openCreateTeamModal} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import Button from 'app/components/buttons/button';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import SentryTypes from 'app/proptypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import recreateRoute from 'app/utils/recreateRoute';

import AllTeamsList from './allTeamsList';

class OrganizationTeams extends React.Component {
  static propTypes = {
    allTeams: PropTypes.arrayOf(SentryTypes.Team),
    activeTeams: PropTypes.arrayOf(SentryTypes.Team),
    organization: SentryTypes.Organization,
    access: PropTypes.object,
    features: PropTypes.object,
    routes: PropTypes.array,
    params: PropTypes.object,
  };

  render() {
    let {
      allTeams,
      activeTeams,
      organization,
      access,
      features,
      routes,
      params,
    } = this.props;
    let org = organization;

    if (!organization) return null;

    let canCreateTeams = getOrganizationState(organization)
      .getAccess()
      .has('project:admin');

    let action = (
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
          })}
        icon="icon-circle-add"
      >
        {t('Create Team')}
      </Button>
    );

    let teamRoute = routes.find(({path}) => path === 'teams/');
    let urlPrefix = recreateRoute(teamRoute, {routes, params, stepBack: -1});

    let activeTeamIds = new Set(activeTeams.map(team => team.id));
    let otherTeams = allTeams.filter(team => !activeTeamIds.has(team.id));

    return (
      <div className="team-list">
        <SettingsPageHeader title={t('Teams')} action={action} />
        <Panel>
          <PanelHeader>{t('Your Teams')}</PanelHeader>
          <PanelBody>
            <AllTeamsList
              useCreateModal
              urlPrefix={urlPrefix}
              organization={org}
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
              useCreateModal
              urlPrefix={urlPrefix}
              organization={org}
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
}

export default OrganizationTeams;

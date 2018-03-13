import PropTypes from 'prop-types';
import React from 'react';

import SentryTypes from '../../../proptypes';
import {t} from '../../../locale';
import AllTeamsList from './allTeamsList';
import {getOrganizationState} from '../../../mixins/organizationState';
import Panel from '../components/panel';
import PanelHeader from '../components/panelHeader';
import PanelBody from '../components/panelBody';
import Button from '../../../components/buttons/button';
import recreateRoute from '../../../utils/recreateRoute';
import SettingsPageHeader from '../components/settingsPageHeader';

class OrganizationTeamsView extends React.Component {
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
        to={`/organizations/${organization.slug}/teams/new/`}
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

export default OrganizationTeamsView;

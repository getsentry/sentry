import PropTypes from 'prop-types';
import React from 'react';

import SentryTypes from '../../../proptypes';
import {t} from '../../../locale';
import AllTeamsList from './allTeamsList';
import {getOrganizationState} from '../../../mixins/organizationState';
import ListLink from '../../../components/listLink';
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
    route: PropTypes.object,
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
      route,
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
      >
        <span className="icon-plus" /> {t('Create Team')}
      </Button>
    );

    let teamRoute = routes.find(({path}) => path === 'teams/');
    let urlPrefix = recreateRoute(teamRoute, {routes, params, stepBack: -1});

    let tabs = (
      <ul className="nav nav-tabs border-bottom">
        <ListLink to={`${urlPrefix}teams/your-teams/`}>{t('Your Teams')}</ListLink>
        <ListLink to={`${urlPrefix}teams/all-teams/`}>
          {t('All Teams')} <span className="badge badge-soft">{allTeams.length}</span>
        </ListLink>
      </ul>
    );

    return (
      <div className="team-list">
        <SettingsPageHeader title={t('Teams')} tabs={tabs} action={action} />
        <AllTeamsList
          urlPrefix={urlPrefix}
          organization={org}
          teamList={route.allTeams ? allTeams : activeTeams}
          access={access}
          openMembership={
            !!(
              route.allTeams &&
              (features.has('open-membership') || access.has('org:write'))
            )
          }
        />
      </div>
    );
  }
}

export default OrganizationTeamsView;

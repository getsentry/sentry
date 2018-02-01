import PropTypes from 'prop-types';
import React from 'react';

import SentryTypes from '../../../proptypes';
import {t} from '../../../locale';
import AllTeamsList from './allTeamsList';
import ListLink from '../../../components/listLink';
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
        <SettingsPageHeader title={t('Teams')} tabs={tabs} />
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

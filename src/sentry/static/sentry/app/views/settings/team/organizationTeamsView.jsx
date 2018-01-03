import PropTypes from 'prop-types';
import React from 'react';

import SentryTypes from '../../../proptypes';
import {t} from '../../../locale';
import ExpandedTeamList from './expandedTeamList';
import AllTeamsList from './allTeamsList';
import ListLink from '../../../components/listLink';
import recreateRoute from '../../../utils/recreateRoute';

class OrganizationTeamsView extends React.Component {
  static propTypes = {
    allTeams: PropTypes.arrayOf(SentryTypes.Team),
    activeTeams: PropTypes.arrayOf(SentryTypes.Team),
    projectStats: PropTypes.array,
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
      projectStats,
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

    return (
      <div className="team-list">
        <ul className="nav nav-tabs border-bottom">
          <ListLink to={`${urlPrefix}teams/your-teams/`}>{t('Your Teams')}</ListLink>
          <ListLink to={`${urlPrefix}teams/all-teams/`}>
            {t('All Teams')} <span className="badge badge-soft">{allTeams.length}</span>
          </ListLink>
        </ul>
        {route.allTeams /* should be AllTeamsList */ ? (
          <AllTeamsList
            urlPrefix={urlPrefix}
            organization={org}
            teamList={allTeams}
            access={access}
            openMembership={features.has('open-membership') || access.has('org:write')}
          />
        ) : (
          <ExpandedTeamList
            urlPrefix={urlPrefix}
            organization={org}
            teamList={activeTeams}
            projectStats={projectStats}
            hasTeams={allTeams.length !== 0}
            access={access}
          />
        )}
      </div>
    );
  }
}

export default OrganizationTeamsView;

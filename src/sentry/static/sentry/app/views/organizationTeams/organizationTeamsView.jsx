import PropTypes from 'prop-types';
import React from 'react';

import SentryTypes from 'app/proptypes';
import {t} from 'app/locale';
import ExpandedTeamList from 'app/views/organizationTeams/expandedTeamList';
import AllTeamsList from 'app/views/organizationTeams/allTeamsList';
import ListLink from 'app/components/listLink';
import OrganizationStatOverview from 'app/views/organizationTeams/organizationStatOverview';
import recreateRoute from 'app/utils/recreateRoute';

class OrganizationTeamsView extends React.Component {
  static propTypes = {
    allTeams: PropTypes.arrayOf(SentryTypes.Team),
    activeTeams: PropTypes.arrayOf(SentryTypes.Team),
    projectList: PropTypes.arrayOf(SentryTypes.Project),
    projectStats: PropTypes.array,
    organization: SentryTypes.Organization,
    access: PropTypes.object,
    features: PropTypes.object,
    route: PropTypes.object,
    routes: PropTypes.array,
    params: PropTypes.object,
  };

  static contextTypes = {
    location: PropTypes.object.isRequired,
  };

  render() {
    let {
      allTeams,
      activeTeams,
      projectList,
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

    let urlPrefix = recreateRoute('', {routes, params, stepBack: -2});

    return (
      <div className="row">
        <div className="col-md-9">
          <div className="team-list">
            <ul className="nav nav-tabs border-bottom">
              <ListLink
                to={`${urlPrefix}teams/your-teams/`}
                isActive={loc => {
                  let pathname = this.context.location.pathname;
                  return pathname === `${urlPrefix}teams/` || pathname === loc.pathname;
                }}
              >
                {t('Your Teams')}
              </ListLink>
              <ListLink to={`${urlPrefix}teams/all-teams/`}>
                {t('All Teams')}{' '}
                <span className="badge badge-soft">{allTeams.length}</span>
              </ListLink>
            </ul>
            {route.allTeams /* should be AllTeamsList */ ? (
              <AllTeamsList
                urlPrefix={urlPrefix}
                organization={org}
                teamList={allTeams}
                access={access}
                openMembership={
                  features.has('open-membership') || access.has('org:write')
                }
              />
            ) : (
              <ExpandedTeamList
                urlPrefix={urlPrefix}
                organization={org}
                teamList={activeTeams}
                projectList={projectList}
                projectStats={projectStats}
                hasTeams={allTeams.length !== 0}
                access={access}
              />
            )}
          </div>
        </div>
        <OrganizationStatOverview
          orgId={this.props.params.orgId}
          className="col-md-3 stats-column"
        />
      </div>
    );
  }
}

export default OrganizationTeamsView;

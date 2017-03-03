import React from 'react';
import Reflux from 'reflux';

import {t} from '../../locale';
import ApiMixin from '../../mixins/apiMixin';
import ListLink from '../../components/listLink';
import OrganizationHomeContainer from '../../components/organizations/homeContainer';
import OrganizationState from '../../mixins/organizationState';
import TeamStore from '../../stores/teamStore';
import {sortArray} from '../../utils';

import ExpandedTeamList from './expandedTeamList';
import OrganizationStatOverview from './organizationStatOverview';
import {loadStats} from '../../actionCreators/projects';

const OrganizationTeams = React.createClass({
  mixins: [
    ApiMixin,
    OrganizationState,
    Reflux.listenTo(TeamStore, 'onTeamListChange')
  ],

  getInitialState() {
    return {
      teamList: sortArray(TeamStore.getAll(), function(o) {
        return o.name;
      }),
      projectStats: {},
    };
  },

  componentWillMount() {
    this.fetchStats();
  },

  fetchStats() {
    loadStats(this.api, {
      orgId: this.props.params.orgId,
      query: {
        since: new Date().getTime() / 1000 - 3600 * 24,
        stat: 'generated',
        group: 'project'
      }
    });
  },

  onTeamListChange() {
    let newTeamList = TeamStore.getAll();

    this.setState({
      teamList: sortArray(newTeamList, function(o) {
        return o.name;
      })
    });
  },

  render() {
    if (!this.context.organization)
      return null;

    let access = this.getAccess();
    let features = this.getFeatures();
    let org = this.getOrganization();

    let allTeams = this.state.teamList;
    let activeTeams = this.state.teamList.filter((team) => team.isMember);

    return (
      <OrganizationHomeContainer>
        <div className="row">
          <div className="col-md-9">
            <div className="team-list">
              <ul className="nav nav-tabs border-bottom">
                <ListLink to={`/organizations/${org.slug}/teams/`}>{t('Your Teams')}</ListLink>
                <ListLink to={`/organizations/${org.slug}/all-teams/`}>{t('All Teams')} <span className="badge badge-soft">{allTeams.length}</span></ListLink>
              </ul>
              {this.props.children ? /* should be AllTeamsList */
                React.cloneElement(this.props.children, {
                  organization: org,
                  teamList: allTeams,
                  access: access,
                  openMembership: features.has('open-membership') || access.has('org:write')
                }) :
                <ExpandedTeamList
                  organization={org} teamList={activeTeams}
                  projectStats={this.state.projectStats}
                  hasTeams={allTeams.length !== 0}
                  access={access}/>
              }
            </div>
          </div>
          <OrganizationStatOverview orgId={this.props.params.orgId} className="col-md-3 stats-column" />
        </div>
      </OrganizationHomeContainer>
    );
  }
});

export default OrganizationTeams;

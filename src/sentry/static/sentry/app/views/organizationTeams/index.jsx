import React from 'react';
import Reflux from 'reflux';

import {t} from '../../locale';
import ApiMixin from '../../mixins/apiMixin';
import ConfigStore from '../../stores/configStore';
import OrganizationHomeContainer from '../../components/organizations/homeContainer';
import OrganizationState from '../../mixins/organizationState';
import TeamStore from '../../stores/teamStore';
import TooltipMixin from '../../mixins/tooltip';
import {sortArray} from '../../utils';

import ExpandedTeamList from './expandedTeamList';
import AllTeamsList from './allTeamsList';
import OrganizationStatOverview from './organizationStatOverview';

const OrganizationTeams = React.createClass({
  mixins: [
    ApiMixin,
    OrganizationState,
    Reflux.listenTo(TeamStore, 'onTeamListChange'),
    TooltipMixin({
      selector: '.tip'
    })
  ],

  getInitialState() {
    return {
      activeNav: 'your-teams',
      teamList: sortArray(TeamStore.getAll(), function(o) {
        return o.name;
      }),
      projectStats: {},
    };
  },

  componentWillMount() {
    this.fetchStats();
  },

  // TODO(dcramer): handle updating project stats when items change
  fetchStats() {
    this.api.request(this.getOrganizationStatsEndpoint(), {
      query: {
        since: new Date().getTime() / 1000 - 3600 * 24,
        stat: 'received',
        group: 'project'
      },
      success: (data) => {
        this.setState({
          projectStats: data
        });
      }
    });
  },

  getOrganizationStatsEndpoint() {
    let params = this.props.params;
    return '/organizations/' + params.orgId + '/stats/';
  },

  onTeamListChange() {
    let newTeamList = TeamStore.getAll();

    this.setState({
      teamList: sortArray(newTeamList, function(o) {
        return o.name;
      })
    });

    this.fetchStats();
  },

  toggleTeams(nav) {
    this.setState({
      activeNav: nav
    });
  },

  render() {
    if (!this.context.organization)
      return null;

    let access = this.getAccess();
    let features = this.getFeatures();
    let org = this.getOrganization();
    let urlPrefix = ConfigStore.get('urlPrefix') + '/organizations/' + org.slug;

    let activeNav = this.state.activeNav;
    let allTeams = this.state.teamList;
    let activeTeams = this.state.teamList.filter((team) => team.isMember);

    return (
      <OrganizationHomeContainer>
        <div className="row">
          <div className="col-md-9">
            <div className="team-list">
              <div className="pull-right">
                {access.has('project:write') ?
                  <a href={urlPrefix + '/projects/new/'} className="btn btn-primary btn-sm"
                     style={{marginRight: 5}}>
                    <span className="icon-plus" /> {t('Project')}
                  </a>
                :
                  <a className="btn btn-primary btn-sm btn-disabled tip"
                     title={t('You do not have enough permission to create new projects')}
                     style={{marginRight: 5}}>
                    <span className="icon-plus" /> {t('Project')}
                  </a>
                }
                {access.has('team:write') ?
                  <a href={urlPrefix + '/teams/new/'} className="btn btn-primary btn-sm">
                    <span className="icon-plus" /> {t('Team')}
                  </a>
                :
                  <a className="btn btn-primary btn-sm btn-disabled tip"
                     title={t('You do not have enough permission to create new teams')}>
                    <span className="icon-plus" /> {t('Team')}
                  </a>
                }
              </div>
              <ul className="nav nav-tabs border-bottom">
                <li className={activeNav === 'your-teams' && 'active'}>
                  <a onClick={this.toggleTeams.bind(this, 'your-teams')}>{t('Your Teams')}</a>
                </li>
                <li className={activeNav === 'all-teams' && 'active'}>
                  <a onClick={this.toggleTeams.bind(this, 'all-teams')}>{t('All Teams')} <span className="badge badge-soft">{allTeams.length}</span></a>
                </li>
              </ul>
              {activeNav == 'your-teams' ?
                <ExpandedTeamList
                    organization={org} teamList={activeTeams}
                    projectStats={this.state.projectStats}
                    hasTeams={allTeams.length !== 0}
                    showAllTeams={this.toggleTeams.bind(this, 'all-teams')} />
              :
                <AllTeamsList
                  organization={org} teamList={allTeams}
                  openMembership={features.has('open-membership') || access.has('org:write')} />
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

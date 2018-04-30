import PropTypes from 'prop-types';
import React from 'react';

import createReactClass from 'create-react-class';

import EmptyMessage from 'app/views/settings/components/emptyMessage';
import IndicatorStore from 'app/stores/indicatorStore';
import {joinTeam} from 'app/actionCreators/teams';
import ApiMixin from 'app/mixins/apiMixin';
import {t} from 'app/locale';

const MissingProjectMembership = createReactClass({
  displayName: 'MissingProjectMembership',

  propTypes: {
    organization: PropTypes.object.isRequired,
    projectId: PropTypes.string.isRequired,
  },

  mixins: [ApiMixin],

  getInitialState() {
    let {organization, projectId} = this.props;
    let project = organization.projects.find(p => p.slug === projectId);

    return {
      loading: false,
      error: false,
      project,
    };
  },

  joinTeam(team) {
    this.setState({
      loading: true,
    });

    joinTeam(
      this.api,
      {
        orgId: this.props.organization.slug,
        teamId: team.slug,
      },
      {
        success: () => {
          this.setState({
            loading: false,
            error: false,
          });
        },
        error: () => {
          this.setState({
            loading: false,
            error: true,
          });
          IndicatorStore.add(
            t('There was an error while trying to leave the team.'),
            'error'
          );
        },
      }
    );
  },

  renderJoinTeam(team, features) {
    if (!team) {
      return null;
    }
    if (this.state.loading) {
      return <a className="btn btn-default btn-loading btn-disabled">...</a>;
    } else if (team.isPending) {
      return <a className="btn btn-default btn-disabled">{t('Request Pending')}</a>;
    } else if (features.has('open-membership')) {
      return (
        <a className="btn btn-default" onClick={this.joinTeam.bind(this, team)}>
          {t('Join Team')}
        </a>
      );
    }
    return (
      <a className="btn btn-default" onClick={this.joinTeam.bind(this, team)}>
        {t('Request Access')}
      </a>
    );
  },

  renderExplanation(features) {
    if (features.has('new-teams')) {
      if (features.has('open-membership')) {
        return t('To view this data you must one of the following teams.');
      } else {
        return t(
          'To view this data you must first request access to one of the following teams:'
        );
      }
    }

    let {project} = this.state;
    let {team} = project;

    if (team) {
      if (features.has('open-membership')) {
        return t('To view this data you must first join the %s team.', team.name);
      }

      return t(
        'To view this data you must first request access to the %s team.',
        team.name
      );
    }

    return t(
      'This project is not associated with any teams. To view this data, an administrator must grant access to a team you are on.'
    );
  },

  renderJoinTeams(features) {
    let {teams} = this.state.project;
    if (!teams.length) {
      return (
        <EmptyMessage>
          {t(
            'No teams have access to this project yet. Ask an admin to add your team to this project.'
          )}
        </EmptyMessage>
      );
    }

    return teams.map(team => {
      return (
        <p key={team.slug}>
          #{team.slug}: {this.renderJoinTeam(team, features)}
        </p>
      );
    });
  },

  render() {
    let {organization} = this.props;
    let {team} = this.state.project;
    let features = new Set(organization.features);

    return (
      <div className="container">
        <div className="box alert-box">
          <span className="icon icon-exclamation" />
          <p>{t("You're not a member of this project.")}</p>
          <p>{this.renderExplanation(features)}</p>
          {features.has('new-teams') ? (
            this.renderJoinTeams(features)
          ) : (
            <p>{this.renderJoinTeam(team, features)}</p>
          )}
        </div>
      </div>
    );
  },
});

export default MissingProjectMembership;

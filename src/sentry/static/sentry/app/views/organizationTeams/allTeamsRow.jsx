import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import {Link} from 'react-router';

import ApiMixin from '../../mixins/apiMixin';
import IndicatorStore from '../../stores/indicatorStore';
import {joinTeam, leaveTeam} from '../../actionCreators/teams';
import {t} from '../../locale';

// TODO(dcramer): this isnt great UX

const AllTeamsRow = createReactClass({
  displayName: 'AllTeamsRow',

  propTypes: {
    access: PropTypes.object.isRequired,
    organization: PropTypes.object.isRequired,
    team: PropTypes.object.isRequired,
    openMembership: PropTypes.bool.isRequired,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: false,
      error: false,
    };
  },

  joinTeam() {
    this.setState({
      loading: true,
    });

    joinTeam(
      this.api,
      {
        orgId: this.props.organization.slug,
        teamId: this.props.team.slug,
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
            t('There was an error while trying to join the team.'),
            'error'
          );
        },
      }
    );
  },

  leaveTeam() {
    this.setState({
      loading: true,
    });

    leaveTeam(
      this.api,
      {
        orgId: this.props.organization.slug,
        teamId: this.props.team.slug,
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

  render() {
    let {access, team, openMembership} = this.props;
    let orgId = this.props.organization.slug;
    return (
      <tr>
        <td>
          <h5>{team.name}</h5>
        </td>
        <td className="actions align-right">
          {this.state.loading ? (
            <a className="btn btn-default btn-sm btn-loading btn-disabled">...</a>
          ) : team.isMember ? (
            <a className="leave-team btn btn-default btn-sm" onClick={this.leaveTeam}>
              {t('Leave Team')}
            </a>
          ) : team.isPending ? (
            <a className="btn btn-default btn-sm btn-disabled">{t('Request Pending')}</a>
          ) : openMembership ? (
            <a className="btn btn-default btn-sm" onClick={this.joinTeam}>
              {t('Join Team')}
            </a>
          ) : (
            <a className="btn btn-default btn-sm" onClick={this.joinTeam}>
              {t('Request Access')}
            </a>
          )}
          {access.has('team:write') && (
            <Link
              className="btn btn-default btn-sm"
              to={`/organizations/${orgId}/teams/${team.slug}/settings/`}
              style={{marginLeft: 5}}
            >
              {t('Team Settings')}
            </Link>
          )}
        </td>
      </tr>
    );
  },
});

export default AllTeamsRow;

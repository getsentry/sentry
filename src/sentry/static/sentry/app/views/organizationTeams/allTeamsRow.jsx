import React from 'react';

import api from '../../api';
import AlertActions from '../../actions/alertActions';
import {t} from '../../locale';

// TODO(dcramer): this isnt great UX

const AllTeamsRow = React.createClass({
  getInitialState() {
    return {
      loading: false,
      error: false
    };
  },

  joinTeam() {
    this.setState({
      loading: true
    });

    api.joinTeam({
      orgId: this.props.organization.slug,
      teamId: this.props.team.slug
    }, {
      success: () => {
        this.setState({
          loading: false,
          error: false
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true
        });
        AlertActions.addAlert(
          t('There was an error while trying to join the team.'),
          'error'
        );
      }
    });
  },

  leaveTeam() {
    this.setState({
      loading: true
    });

    api.leaveTeam({
      orgId: this.props.organization.slug,
      teamId: this.props.team.slug
    }, {
      success: () => {
        this.setState({
          loading: false,
          error: false
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true
        });
        AlertActions.addAlert(
          t('There was an error while trying to leave the team.'),
          'error'
        );
      }
    });
  },

  render() {
    let {team, openMembership} = this.props;
    return (
     <tr>
        <td>
          <h5>{team.name}</h5>
        </td>
        <td className="actions align-right">
          {this.state.loading ?
            <a className="btn btn-default btn-sm btn-loading btn-disabled">...</a>
          : (team.isMember ?
            <a className="leave-team btn btn-default btn-sm"
               onClick={this.leaveTeam}>{t('Leave Team')}</a>
          : (team.isPending ?
            <a className="btn btn-default btn-sm btn-disabled">{t('Request Pending')}</a>
          : (openMembership ?
            <a className="btn btn-default btn-sm"
               onClick={this.joinTeam}>{t('Join Team')}</a>
          :
            <a className="btn btn-default btn-sm"
               onClick={this.joinTeam}>{t('Request Access')}</a>
          )))}
        </td>
      </tr>
    );
  }
});

export default AllTeamsRow;

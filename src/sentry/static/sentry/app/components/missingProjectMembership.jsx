import React from 'react';

import AlertActions from '../actions/alertActions';
import api from '../api';

const ERR_JOIN = 'There was an error while trying to join the team.';

const MissingProjectMembership = React.createClass({
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
        AlertActions.addAlert(ERR_JOIN, 'error');
      }
    });
  },

  render() {
    let {organization, team} = this.props;
    let openMembership = organization.features.indexOf('open-membership') !== -1;

    return (
      <div className="container">
        <div className="box alert-box">
          <span className="icon icon-exclamation"></span>
          <p>{'You\'re not a member of this project.'}</p>
          {openMembership ?
            <p>To view this data you must first join the {team.name} team.</p>
          :
            <p>To view this data you must first request access to the {team.name} team.</p>
          }
          <p>
            {this.state.loading ?
              <a className="btn btn-default btn-loading btn-disabled">...</a>
            : (team.isPending ?
              <a className="btn btn-default btn-disabled">Request Pending</a>
            : (openMembership ?
              <a className="btn btn-default"
                 onClick={this.joinTeam}>Join Team</a>
            :
              <a className="btn btn-default"
                 onClick={this.joinTeam}>Request Access</a>
            ))}
          </p>
        </div>
      </div>
    );
  }
});

export default MissingProjectMembership;

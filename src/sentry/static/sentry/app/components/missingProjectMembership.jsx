import React from 'react';

import AlertActions from '../actions/alertActions';
import ApiMixin from '../mixins/apiMixin';
import {t} from '../locale';

const MissingProjectMembership = React.createClass({
  propTypes: {
    organization: React.PropTypes.object.isRequired,
    team: React.PropTypes.object.isRequired
  },

  mixins: [
    ApiMixin
  ],

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

    this.api.joinTeam({
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
        AlertActions.addAlert({
            message: 'There was an error while trying to join the team.',
            type: 'error'
        });
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
            <p>{t('To view this data you must first join the %s team.', team.name)}</p>
          :
            <p>{t('To view this data you must first request access to the %s team.', team.name)}</p>
          }
          <p>
            {this.state.loading ?
              <a className="btn btn-default btn-loading btn-disabled">...</a>
            : (team.isPending ?
              <a className="btn btn-default btn-disabled">{t('Request Pending')}</a>
            : (openMembership ?
              <a className="btn btn-default"
                 onClick={this.joinTeam}>{t('Join Team')}</a>
            :
              <a className="btn btn-default"
                 onClick={this.joinTeam}>{t('Request Access')}</a>
            ))}
          </p>
        </div>
      </div>
    );
  }
});

export default MissingProjectMembership;

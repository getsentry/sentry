import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import {Link} from 'react-router';
import {Box} from 'grid-emotion';

import ApiMixin from '../../../mixins/apiMixin';
import AlertActions from '../../../actions/alertActions';
import PanelItem from '../components/panelItem';
import {joinTeam, leaveTeam} from '../../../actionCreators/teams';
import {t} from '../../../locale';

// TODO(dcramer): this isnt great UX

const AllTeamsRow = createReactClass({
  displayName: 'AllTeamsRow',

  propTypes: {
    urlPrefix: PropTypes.string.isRequired,
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
          AlertActions.addAlert({
            message: t('There was an error while trying to join the team.'),
            type: 'error',
          });
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
          AlertActions.addAlert({
            message: t('There was an error while trying to leave the team.'),
            type: 'error',
          });
        },
      }
    );
  },

  render() {
    let {access, team, urlPrefix, openMembership, organization} = this.props;
    let features = new Set(organization.features);
    let display = features.has('internal-catchall') ? team.slug : team.name;
    return (
      <PanelItem p={0} align="center">
        <Box flex="1" p={2}>
          {access.has('team:write') ? (
            <Link to={`${urlPrefix}teams/${team.slug}/settings/`}>{display}</Link>
          ) : (
            display
          )}
        </Box>
        <Box p={2}>
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
        </Box>
      </PanelItem>
    );
  },
});

export default AllTeamsRow;

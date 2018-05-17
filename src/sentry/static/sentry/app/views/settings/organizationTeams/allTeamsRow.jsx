import {Box} from 'grid-emotion';
import {Link} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {joinTeam, leaveTeam} from 'app/actionCreators/teams';
import {t, tct} from 'app/locale';
import ApiMixin from 'app/mixins/apiMixin';
import {PanelItem} from 'app/components/panels';
import IdBadge from 'app/components/idBadge';

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
    let {organization, team} = this.props;

    this.setState({
      loading: true,
    });

    joinTeam(
      this.api,
      {
        orgId: organization.slug,
        teamId: team.slug,
      },
      {
        success: () => {
          this.setState({
            loading: false,
            error: false,
          });
          addSuccessMessage(
            tct('You have joined [team]', {
              team: `#${team.slug}`,
            })
          );
        },
        error: () => {
          this.setState({
            loading: false,
            error: true,
          });
          addErrorMessage(
            tct('Unable to join [team]', {
              team: `#${team.slug}`,
            })
          );
        },
      }
    );
  },

  leaveTeam() {
    let {organization, team} = this.props;

    this.setState({
      loading: true,
    });

    leaveTeam(
      this.api,
      {
        orgId: organization.slug,
        teamId: team.slug,
      },
      {
        success: () => {
          this.setState({
            loading: false,
            error: false,
          });
          addSuccessMessage(
            tct('You have left [team]', {
              team: `#${team.slug}`,
            })
          );
        },
        error: () => {
          this.setState({
            loading: false,
            error: true,
          });
          addErrorMessage(
            tct('Unable to leave [team]', {
              team: `#${team.slug}`,
            })
          );
        },
      }
    );
  },

  render() {
    let {access, team, urlPrefix, openMembership, organization} = this.props;
    let features = new Set(organization.features);
    let display = features.has('new-teams') ? <IdBadge team={team} /> : team.name;
    return (
      <PanelItem p={0} align="center">
        <Box flex="1" p={2}>
          {access.has('team:write') ? (
            <Link to={`${urlPrefix}teams/${team.slug}/`}>{display}</Link>
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

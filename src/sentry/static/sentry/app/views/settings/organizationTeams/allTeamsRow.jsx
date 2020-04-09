import {Link} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {PanelItem} from 'app/components/panels';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {callIfFunction} from 'app/utils/callIfFunction';
import {joinTeam, leaveTeam} from 'app/actionCreators/teams';
import {t, tct, tn} from 'app/locale';
import Button from 'app/components/button';
import IdBadge from 'app/components/idBadge';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';

class AllTeamsRow extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    urlPrefix: PropTypes.string.isRequired,
    organization: PropTypes.object.isRequired,
    team: PropTypes.object.isRequired,
    openMembership: PropTypes.bool.isRequired,

    onRequestAccess: PropTypes.func,
    onJoinTeam: PropTypes.func,
    onLeaveTeam: PropTypes.func,
  };

  state = {
    loading: false,
    error: false,
  };

  handleRequestAccess = () => {
    const {team, onRequestAccess} = this.props;

    const promise = this.joinTeam({
      successMessage: tct('You have requested access to [team]', {
        team: `#${team.slug}`,
      }),

      errorMessage: tct('Unable to request access to [team]', {
        team: `#${team.slug}`,
      }),
    });

    callIfFunction(onRequestAccess, team, promise);
  };

  handleJoinTeam = () => {
    const {team, onJoinTeam} = this.props;

    const promise = this.joinTeam({
      successMessage: tct('You have joined [team]', {
        team: `#${team.slug}`,
      }),
      errorMessage: tct('Unable to join [team]', {
        team: `#${team.slug}`,
      }),
    });

    callIfFunction(onJoinTeam, team, promise);
  };

  joinTeam = ({successMessage, errorMessage}) => {
    const {api, organization, team} = this.props;

    this.setState({
      loading: true,
    });

    return new Promise((resolve, reject) =>
      joinTeam(
        api,
        {
          orgId: organization.slug,
          teamId: team.slug,
        },
        {
          success: resp => {
            this.setState({
              loading: false,
              error: false,
            });
            addSuccessMessage(successMessage);
            resolve(resp);
          },
          error: () => {
            this.setState({
              loading: false,
              error: true,
            });
            addErrorMessage(errorMessage);
            reject(new Error(errorMessage));
          },
        }
      )
    );
  };

  handleLeaveTeam = () => {
    const {api, organization, team, onLeaveTeam} = this.props;

    this.setState({
      loading: true,
    });

    const promise = new Promise((resolve, reject) =>
      leaveTeam(
        api,
        {
          orgId: organization.slug,
          teamId: team.slug,
        },
        {
          success: resp => {
            this.setState({
              loading: false,
              error: false,
            });
            addSuccessMessage(
              tct('You have left [team]', {
                team: `#${team.slug}`,
              })
            );
            resolve(resp);
          },
          error: () => {
            this.setState({
              loading: false,
              error: true,
            });
            const message = tct('Unable to leave [team]', {
              team: `#${team.slug}`,
            });
            addErrorMessage(message);
            reject(new Error(message));
          },
        }
      )
    );

    callIfFunction(onLeaveTeam, team, promise);
  };

  render() {
    const {team, urlPrefix, openMembership} = this.props;
    const display = (
      <IdBadge
        team={team}
        avatarSize={36}
        description={tn('%s Member', '%s Members', team.memberCount)}
      />
    );

    // You can only view team details if you have access to team -- this should account
    // for your role + org open memberhsip
    const canViewTeam = team.hasAccess;

    return (
      <TeamPanelItem>
        <TeamNameWrapper>
          {canViewTeam ? (
            <TeamLink to={`${urlPrefix}teams/${team.slug}/`}>{display}</TeamLink>
          ) : (
            display
          )}
        </TeamNameWrapper>
        <Spacer>
          {this.state.loading ? (
            <Button size="small" disabled>
              ...
            </Button>
          ) : team.isMember ? (
            <Button size="small" onClick={this.handleLeaveTeam}>
              {t('Leave Team')}
            </Button>
          ) : team.isPending ? (
            <Button size="small" disabled>
              {t('Request Pending')}
            </Button>
          ) : openMembership ? (
            <Button size="small" onClick={this.handleJoinTeam}>
              {t('Join Team')}
            </Button>
          ) : (
            <Button size="small" onClick={this.handleRequestAccess}>
              {t('Request Access')}
            </Button>
          )}
        </Spacer>
      </TeamPanelItem>
    );
  }
}

const TeamLink = styled(Link)`
  display: inline-block;

  &.focus-visible {
    margin: -${space(1)};
    padding: ${space(1)};
    background: #f2eff5;
    border-radius: 3px;
    outline: none;
  }
`;

export {AllTeamsRow};
export default withApi(AllTeamsRow, {persistInFlight: true});

const TeamPanelItem = styled(PanelItem)`
  padding: 0;
  align-items: center;
`;

const Spacer = styled('div')`
  padding: ${space(2)};
`;

const TeamNameWrapper = styled(Spacer)`
  flex: 1;
`;

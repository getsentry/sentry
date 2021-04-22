import React from 'react';
import {Link} from 'react-router';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {joinTeam, leaveTeam} from 'app/actionCreators/teams';
import {Client} from 'app/api';
import Button from 'app/components/button';
import IdBadge from 'app/components/idBadge';
import {PanelItem} from 'app/components/panels';
import {t, tct, tn} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Team} from 'app/types';
import withApi from 'app/utils/withApi';

type Props = {
  api: Client;
  urlPrefix: string;
  organization: Organization;
  team: Team;
  openMembership: boolean;
};

type State = {
  loading: boolean;
  error: boolean;
};

class AllTeamsRow extends React.Component<Props, State> {
  state = {
    loading: false,
    error: false,
  };

  handleRequestAccess = async () => {
    const {team} = this.props;

    try {
      this.joinTeam({
        successMessage: tct('You have requested access to [team]', {
          team: `#${team.slug}`,
        }),

        errorMessage: tct('Unable to request access to [team]', {
          team: `#${team.slug}`,
        }),
      });

      // TODO: Ideally we would update team so that `isPending` is true
    } catch (_err) {
      // No need to do anything
    }
  };

  handleJoinTeam = () => {
    const {team} = this.props;

    this.joinTeam({
      successMessage: tct('You have joined [team]', {
        team: `#${team.slug}`,
      }),
      errorMessage: tct('Unable to join [team]', {
        team: `#${team.slug}`,
      }),
    });
  };

  joinTeam = ({successMessage, errorMessage}) => {
    const {api, organization, team} = this.props;

    this.setState({
      loading: true,
    });

    return new Promise<void>((resolve, reject) =>
      joinTeam(
        api,
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
            addSuccessMessage(successMessage);
            resolve();
          },
          error: () => {
            this.setState({
              loading: false,
              error: true,
            });
            addErrorMessage(errorMessage);
            reject(new Error('Unable to join team'));
          },
        }
      )
    );
  };

  handleLeaveTeam = () => {
    const {api, organization, team} = this.props;

    this.setState({
      loading: true,
    });

    leaveTeam(
      api,
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
    // for your role + org open membership
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
export default withApi(AllTeamsRow);

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

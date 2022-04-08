import * as React from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {joinTeam, leaveTeam} from 'sentry/actionCreators/teams';
import TeamActions from 'sentry/actions/teamActions';
import {Client} from 'sentry/api';
import Button from 'sentry/components/button';
import IdBadge from 'sentry/components/idBadge';
import Link from 'sentry/components/links/link';
import {PanelItem} from 'sentry/components/panels';
import {t, tct, tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Team} from 'sentry/types';
import withApi from 'sentry/utils/withApi';

type Props = {
  api: Client;
  openMembership: boolean;
  organization: Organization;
  team: Team;
  urlPrefix: string;
};

type State = {
  error: boolean;
  loading: boolean;
};

class AllTeamsRow extends React.Component<Props, State> {
  state: State = {
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

      // Update team so that `isPending` is true
      TeamActions.updateSuccess(team.slug, {
        ...team,
        isPending: true,
      });
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

  joinTeam = ({
    successMessage,
    errorMessage,
  }: {
    errorMessage: React.ReactNode;
    successMessage: React.ReactNode;
  }) => {
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
            <Button
              size="small"
              disabled
              title={t(
                'Your request to join this team is being reviewed by organization owners'
              )}
            >
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

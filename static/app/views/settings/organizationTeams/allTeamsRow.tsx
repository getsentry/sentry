import {Component} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {fetchOrganizationDetails} from 'sentry/actionCreators/organizations';
import {joinTeam, leaveTeam} from 'sentry/actionCreators/teams';
import {Client} from 'sentry/api';
import {Button} from 'sentry/components/button';
import IdBadge from 'sentry/components/idBadge';
import Link from 'sentry/components/links/link';
import {PanelItem} from 'sentry/components/panels';
import {t, tct, tn} from 'sentry/locale';
import TeamStore from 'sentry/stores/teamStore';
import {space} from 'sentry/styles/space';
import {Organization, Team} from 'sentry/types';
import withApi from 'sentry/utils/withApi';

type Props = {
  access: Record<string, any>;
  api: Client;
  openMembership: boolean;
  organization: Organization;
  team: Team;
};

type State = {
  error: boolean;
  loading: boolean;
};

class AllTeamsRow extends Component<Props, State> {
  state: State = {
    loading: false,
    error: false,
  };

  reloadProjects() {
    const {api, organization} = this.props;
    // After a change in teams has happened, refresh the project store
    fetchOrganizationDetails(api, organization.slug, {
      loadProjects: true,
    });
  }

  handleRequestAccess = () => {
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
      TeamStore.onUpdateSuccess(team.slug, {
        ...team,
        isPending: true,
      });
    } catch (_err) {
      // No need to do anything
    }
  };

  handleJoinTeam = async () => {
    const {team} = this.props;

    await this.joinTeam({
      successMessage: tct('You have joined [team]', {
        team: `#${team.slug}`,
      }),
      errorMessage: tct('Unable to join [team]', {
        team: `#${team.slug}`,
      }),
    });

    this.reloadProjects();
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

          // Reload ProjectsStore
          this.reloadProjects();
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

  getTeamRoleName = () => {
    const {organization, team} = this.props;
    if (!organization.features.includes('team-roles') || !team.teamRole) {
      return null;
    }

    const {teamRoleList} = organization;
    const roleName = teamRoleList.find(r => r.id === team.teamRole)?.name;

    return roleName;
  };

  render() {
    const {team, openMembership, organization, access} = this.props;
    const urlPrefix = `/settings/${organization.slug}/teams/`;
    const hasAccess = access.has('org:write') || access.has('team:admin');

    // TODO(team-roles): team admins can also manage membership
    const isOrgAdmin = access.has('org:admin');

    const buttonHelpText = () => {
      if (team.flags['idp:provisioned']) {
        return t(
          "Membership to this team is managed through your organization's identity provider."
        );
      }
      if (team.orgRole && (!hasAccess || !isOrgAdmin)) {
        return t(
          'Membership to a team with an organization role is managed by org owners.'
        );
      }
      return undefined;
    };

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

    const idpProvisioned = team.flags['idp:provisioned'];
    const teamOrgRole = team.orgRole
      ? team.orgRole.charAt(0).toUpperCase() + team.orgRole.slice(1) + ' Team'
      : null;
    const roleDisplay = () => {
      if (teamOrgRole === null && this.getTeamRoleName() === null) {
        return 'none';
      }
      return 'block';
    };
    // TODO(team-roles): team admins can also manage membership
    const isDisabled = idpProvisioned || (team.orgRole !== null && !isOrgAdmin);

    return (
      <TeamPanelItem>
        <div>
          {canViewTeam ? (
            <TeamLink data-test-id="team-link" to={`${urlPrefix}${team.slug}/`}>
              {display}
            </TeamLink>
          ) : (
            display
          )}
        </div>
        <div style={{display: roleDisplay()}}>{teamOrgRole}</div>
        <div style={{display: roleDisplay()}}>{this.getTeamRoleName()}</div>
        <div>
          {this.state.loading ? (
            <Button size="sm" disabled>
              ...
            </Button>
          ) : team.isMember ? (
            <Button
              size="sm"
              onClick={this.handleLeaveTeam}
              disabled={isDisabled}
              title={buttonHelpText()}
            >
              {t('Leave Team')}
            </Button>
          ) : team.isPending ? (
            <Button
              size="sm"
              disabled
              title={t(
                'Your request to join this team is being reviewed by organization owners'
              )}
            >
              {t('Request Pending')}
            </Button>
          ) : openMembership ? (
            <Button
              size="sm"
              onClick={this.handleJoinTeam}
              disabled={isDisabled}
              title={buttonHelpText()}
            >
              {t('Join Team')}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={this.handleRequestAccess}
              disabled={isDisabled}
              title={buttonHelpText()}
            >
              {t('Request Access')}
            </Button>
          )}
        </div>
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
  display: grid;
  grid-template-columns: minmax(150px, 4fr) min-content;
  grid-template-rows: auto min-content;
  gap: ${space(2)};
  align-items: center;

  > div:last-child {
    margin-left: auto;
  }

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: minmax(150px, 3fr) minmax(90px, 1fr) minmax(90px, 1fr) min-content;
    grid-template-rows: auto;
    > div:empty {
      display: block !important;
    }
  }
`;

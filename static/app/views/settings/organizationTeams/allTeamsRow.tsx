import {Component} from 'react';
import styled from '@emotion/styled';
import startCase from 'lodash/startCase';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {fetchOrganizationDetails} from 'sentry/actionCreators/organizations';
import {joinTeam, leaveTeam} from 'sentry/actionCreators/teams';
import {Client} from 'sentry/api';
import {Button} from 'sentry/components/button';
import IdBadge from 'sentry/components/idBadge';
import Link from 'sentry/components/links/link';
import PanelItem from 'sentry/components/panels/panelItem';
import {t, tct, tn} from 'sentry/locale';
import TeamStore from 'sentry/stores/teamStore';
import {space} from 'sentry/styles/space';
import {Organization, Team} from 'sentry/types';
import withApi from 'sentry/utils/withApi';
import {getButtonHelpText} from 'sentry/views/settings/organizationTeams/utils';

type Props = {
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
    const {teamRoleList} = organization;
    const roleName = teamRoleList.find(r => r.id === team.teamRole)?.name;

    return roleName;
  };

  render() {
    const {team, openMembership, organization} = this.props;
    const {access} = organization;
    const urlPrefix = `/settings/${organization.slug}/teams/`;
    const canEditTeam = access.includes('org:write') || access.includes('team:admin');

    // TODO(team-roles): team admins can also manage membership
    // org:admin is a unique scope that only org owners have
    const isOrgOwner = access.includes('org:admin');
    const isPermissionGroup = !!team.orgRole && (!canEditTeam || !isOrgOwner);
    const isIdpProvisioned = team.flags['idp:provisioned'];

    const buttonHelpText = getButtonHelpText(isIdpProvisioned, isPermissionGroup);

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

    const orgRoleFromTeam = team.orgRole ? `${startCase(team.orgRole)} Team` : null;
    const isHidden = orgRoleFromTeam === null && this.getTeamRoleName() === null;
    const isDisabled = isIdpProvisioned || isPermissionGroup;

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
        <DisplayRole isHidden={isHidden}>{orgRoleFromTeam}</DisplayRole>
        <DisplayRole isHidden={isHidden}>{this.getTeamRoleName()}</DisplayRole>
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
              title={buttonHelpText}
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
              title={buttonHelpText}
            >
              {t('Join Team')}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={this.handleRequestAccess}
              disabled={isDisabled}
              title={buttonHelpText}
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

export const GRID_TEMPLATE = `
  display: grid;
  grid-template-columns: minmax(150px, 4fr) minmax(0px, 100px) 125px minmax(150px, 1fr);
  gap: ${space(1)};
`;

const TeamPanelItem = styled(PanelItem)`
  ${GRID_TEMPLATE}
  align-items: center;

  > div:last-child {
    margin-left: auto;
  }
`;

const DisplayRole = styled('div')<{isHidden: boolean}>`
  display: ${props => (props.isHidden ? 'none' : 'block')};
`;

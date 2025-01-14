import PanelAlert from 'sentry/components/panels/panelAlert';
import {Tooltip} from 'sentry/components/tooltip';
import {IconInfo} from 'sentry/icons';
import {tct} from 'sentry/locale';
import type {OrgRole, TeamRole} from 'sentry/types/organization';

type Props = {
  orgRole: OrgRole['id'] | undefined;
  orgRoleList: OrgRole[];
  teamRoleList: TeamRole[];
  isSelf?: boolean;
};

export function RoleOverwriteIcon(props: Props) {
  const hasOverride = hasOrgRoleOverwrite(props);
  if (!hasOverride) {
    return null;
  }

  return (
    <Tooltip title={getOverwriteString(props)}>
      <IconInfo size="sm" color="gray300" />
    </Tooltip>
  );
}

export function RoleOverwritePanelAlert(props: Props) {
  const hasOverride = hasOrgRoleOverwrite(props);
  if (!hasOverride) {
    return null;
  }

  return (
    <PanelAlert data-test-id="alert-role-overwrite">
      {getOverwriteString(props)}
    </PanelAlert>
  );
}

/**
 * Check that the user's org role has a minimum team role that maps to the lowest
 * possible team role
 */
export function hasOrgRoleOverwrite(props: Props) {
  const {orgRole, orgRoleList, teamRoleList} = props;

  const orgRoleObj = orgRoleList.find(r => r.id === orgRole);
  return teamRoleList.findIndex(r => r.id === orgRoleObj?.minimumTeamRole) > 0;
}

/**
 * Standardize string so situations where org-level vs team-level roles is easier to recognize
 */
export function getOverwriteString(props: Props) {
  const {orgRole, orgRoleList, teamRoleList, isSelf} = props;
  const orgRoleObj = orgRoleList.find(r => r.id === orgRole);
  const teamRoleObj = teamRoleList.find(r => r.id === orgRoleObj?.minimumTeamRole);
  if (!orgRoleObj || !teamRoleObj) {
    return '';
  }

  return tct(
    '[selfNoun] organization role as [article] [orgRole] has granted [selfPronoun] a minimum team-level role of [teamRole]',
    {
      selfNoun: isSelf ? 'Your' : "This user's",
      selfPronoun: isSelf ? 'you' : 'them',
      article: 'AEIOU'.includes(orgRoleObj.name[0]!) ? 'an' : 'a',
      orgRole: <strong>{orgRoleObj.name}</strong>,
      teamRole: <strong>{teamRoleObj.name}</strong>,
    }
  );
}

export default RoleOverwriteIcon;

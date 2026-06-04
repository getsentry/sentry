export interface BaseRole {
  desc: string;
  id: string;
  name: string;
  isAllowed?: boolean;
  isRetired?: boolean;
  isTeamRolesAllowed?: boolean;
}
export interface OrgRole extends BaseRole {
  minimumTeamRole: string;
  isGlobal?: boolean;
  /**
   * @deprecated use isGlobal
   */
  is_global?: boolean;
}
export interface TeamRole extends BaseRole {
  isMinimumRoleFor: string;
}

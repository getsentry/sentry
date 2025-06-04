/**
 * Control Silo Organizations are sent back from primarily control silo endpoints that do not have rights to access
 * detailed regional organization information.
 */

export interface ControlSiloOrganization {
  id: string;
  name: string;
  slug: string;
}

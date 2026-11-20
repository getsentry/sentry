/**
 * What owns an account's lifecycle. Accounts owned by a Seer workflow config are
 * managed from that config and deleted with it.
 */
type ServiceAccountOwnerKind = 'organization' | 'seer_workflow_config';

export interface ServiceAccount {
  allProjects: boolean;
  dateCreated: string;
  id: string;
  name: string;
  ownerKind: ServiceAccountOwnerKind | null;
  projectIds: string[];
  scopes: string[];
}

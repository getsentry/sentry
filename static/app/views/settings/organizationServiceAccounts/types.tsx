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

export interface ServiceAccountInput {
  allProjects: boolean;
  name: string;
  projectIds: number[];
  scopes: string[];
}

export interface ServiceAccountToken {
  dateCreated: string;
  dateExpires: string | null;
  dateLastUsed: string | null;
  id: string;
  name: string;
  scopes: string[];
  tokenLastCharacters: string;
}

/** Only the response that creates a token includes its value. */
export interface NewServiceAccountToken extends ServiceAccountToken {
  token: string;
}

export interface ServiceAccountTokenInput {
  /** Null makes a token that never expires. */
  expiresAt: string | null;
  name: string;
  scopes: string[];
}

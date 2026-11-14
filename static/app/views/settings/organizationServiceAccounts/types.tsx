import type {GuardrailId} from './serviceAccountData';

interface ServiceAccountActor {
  name: string;
}

/**
 * Mirrors the service account API response (`id`, `name`, `scopes`, `projectIds`,
 * `allProjects`, `dateCreated`). The other fields are what the UI mock needs and
 * the API doesn't return yet.
 */
export interface ServiceAccount {
  activeTokenCount: number;
  allProjects: boolean;
  bundleId: string;
  createdBy: ServiceAccountActor;
  customScopes: string[];
  dateCreated: string;
  dateLastActive: string | null;
  description: string;
  guardrails: GuardrailId[];
  id: string;
  name: string;
  projectIds: string[];
  scopes: string[];
}

/** Mirrors the service account token list response, plus `createdBy`. */
export interface ServiceAccountToken {
  createdBy: ServiceAccountActor;
  dateCreated: string;
  dateExpires: string | null;
  dateLastUsed: string | null;
  id: string;
  name: string;
  scopes: string[];
  tokenLastCharacters: string;
}

/** Only the create response includes the plaintext token. */
export interface NewServiceAccountToken extends ServiceAccountToken {
  token: string;
}

export interface ServiceAccountInput {
  allProjects: boolean;
  bundleId: string;
  customScopes: string[];
  description: string;
  guardrails: GuardrailId[];
  name: string;
  projectIds: string[];
}

export interface ServiceAccountTokenInput {
  dateExpires: string | null;
  name: string;
  scopes: string[];
}

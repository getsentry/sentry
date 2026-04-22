import type {
  Integration,
  IntegrationProvider,
  IntegrationRepository,
  OrganizationIntegration,
  Repository,
} from 'sentry/types/integrations';

export interface ProviderNode {
  integrationCount: number;
  isExpanded: boolean;
  provider: IntegrationProvider;
  type: 'provider';
}

export interface IntegrationNode {
  connectedRepoCount: number;
  integration: OrganizationIntegration;
  isExpanded: boolean;
  isReposPending: boolean;
  repoCount: number;
  type: 'integration';
}

export interface RepoNode {
  integration: Integration;
  isConnected: boolean;
  isToggling: boolean;
  repo: IntegrationRepository;
  type: 'repo';
}

export interface AddConfigNode {
  provider: IntegrationProvider;
  type: 'add-config';
}

export interface NoMatchNode {
  integrationId: string;
  repoFilter: RepoFilter;
  search: string;
  type: 'no-match';
}

export interface DisconnectedSectionNode {
  isExpanded: boolean;
  repoCount: number;
  type: 'disconnected-section';
}

export interface DisconnectedRepoNode {
  isToggling: boolean;
  repo: Repository;
  type: 'disconnected-repo';
}

export type TreeNode =
  | ProviderNode
  | IntegrationNode
  | RepoNode
  | AddConfigNode
  | NoMatchNode
  | DisconnectedSectionNode
  | DisconnectedRepoNode;

export type RepoFilter = 'all' | 'connected' | 'not-connected';
export type ProviderFilter = 'seer-supported' | 'all';

import type {
  Integration,
  IntegrationProvider,
  IntegrationRepository,
} from 'sentry/types/integrations';

export type ProviderNode = {
  integrationCount: number;
  isExpanded: boolean;
  provider: IntegrationProvider;
  type: 'provider';
};

export type IntegrationNode = {
  connectedRepoCount: number;
  integration: Integration;
  isExpanded: boolean;
  isReposPending: boolean;
  repoCount: number;
  type: 'integration';
};

export type RepoNode = {
  integration: Integration;
  isConnected: boolean;
  isToggling: boolean;
  repo: IntegrationRepository;
  type: 'repo';
};

export type AddConfigNode = {
  provider: IntegrationProvider;
  type: 'add-config';
};

export type NoMatchNode = {
  integrationId: string;
  repoFilter: RepoFilter;
  search: string;
  type: 'no-match';
};

export type TreeNode =
  | ProviderNode
  | IntegrationNode
  | RepoNode
  | AddConfigNode
  | NoMatchNode;

export type RepoFilter = 'all' | 'connected' | 'not-connected';
export type ProviderFilter = 'seer-supported' | 'all';

import type {
  Integration,
  IntegrationProvider,
  IntegrationRepository,
  OrganizationIntegration,
  Repository,
} from 'sentry/types/integrations';

type ProviderNode = {
  integrationCount: number;
  isExpanded: boolean;
  provider: IntegrationProvider;
  type: 'provider';
};

type IntegrationNode = {
  connectedRepoCount: number;
  integration: OrganizationIntegration;
  isExpanded: boolean;
  isReposPending: boolean;
  repoCount: number;
  type: 'integration';
};

type RepoNode = {
  integration: Integration;
  isConnected: boolean;
  isToggling: boolean;
  repo: IntegrationRepository;
  type: 'repo';
};

type AddConfigNode = {
  provider: IntegrationProvider;
  type: 'add-config';
};

type NoMatchNode = {
  integrationId: string;
  repoFilter: RepoFilter;
  search: string;
  type: 'no-match';
};

type DisconnectedSectionNode = {
  isExpanded: boolean;
  repoCount: number;
  type: 'disconnected-section';
};

type DisconnectedRepoNode = {
  isToggling: boolean;
  repo: Repository;
  type: 'disconnected-repo';
};

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

export type ExternalActorMapping = {
  externalName: string;
  id: string;
  sentryName: string;
  teamId?: string;
  userId?: string;
};
export type ExternalActorSuggestion = {
  externalName: string;
  teamId?: string;
  userId?: string;
};
export type ExternalActorMappingOrSuggestion =
  | ExternalActorMapping
  | ExternalActorSuggestion;
export type ExternalUser = {
  externalName: string;
  id: string;
  integrationId: string;
  memberId: string;
  provider: string;
};
export type ExternalTeam = {
  externalName: string;
  id: string;
  integrationId: string;
  provider: string;
  teamId: string;
};
/**
 * Repositories, pull requests, and commits
 */
export enum RepositoryStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
  HIDDEN = 'hidden',
  PENDING_DELETION = 'pending_deletion',
  DELETION_IN_PROGRESS = 'deletion_in_progress',
}
export type Repository = {
  dateCreated: string;
  externalId: string;
  externalSlug: string;
  id: string;
  integrationId: string;
  name: string;
  provider: {id: string; name: string};
  status: RepositoryStatus;
  url: string;
};
/**
 * Integration Repositories from OrganizationIntegrationReposEndpoint
 */
export type IntegrationRepository = {
  externalId: string;
  /**
   * ex - getsentry/sentry
   */
  identifier: string;
  isInstalled: boolean;
  name: string;
  defaultBranch?: string | null;
  url?: string | null;
};
export type CommitAuthor = {
  email?: string;
  name?: string;
};
export type CommitFile = {
  author: CommitAuthor;
  commitMessage: string;
  filename: string;
  id: string;
  orgId: number;
  repoName: string;
  type: string;
};
export type PullRequest = {
  dateCreated: string;
  externalUrl: string;
  id: string;
  message: string | null;
  repository: Repository;
  title: string | null;
  author?: CommitAuthor;
};
/**
 * Sentry Apps
 */
export type SentryAppStatus =
  | 'unpublished'
  | 'published'
  | 'internal'
  | 'publish_request_inprogress'
  | 'deletion_in_progress';
export type SentryAppSchemaIssueLink = {
  create: {
    required_fields: any[];
    uri: string;
    optional_fields?: any[];
  };
  link: {
    required_fields: any[];
    uri: string;
    optional_fields?: any[];
  };
  type: 'issue-link';
};
export type SentryAppSchemaStacktraceLink = {
  type: 'stacktrace-link';
  uri: string;
  url: string;
  params?: string[];
};
type SentryAppSchemaAlertRuleAction = {
  settings: SentryAppSchemaAlertRuleActionSettings;
  title: string;
  type: 'alert-rule-action';
};
type SentryAppSchemaAlertRuleActionSettings = {
  description: string;
  // a list of FormFields
  required_fields: any[];
  type: 'alert-rule-settings';
  uri: string;
  optional_fields?: any[];
};
export type StacktraceErrorMessage =
  | 'file_not_found'
  | 'stack_root_mismatch'
  | 'integration_link_forbidden';
export type SentryAppSchemaElement =
  | SentryAppSchemaIssueLink
  | SentryAppSchemaAlertRuleAction
  | SentryAppSchemaStacktraceLink;
export type SentryAppInstallation = {
  app: {
    slug: string;
    uuid: string;
  };
  organization: {
    slug: string;
  };
  status: 'installed' | 'pending' | 'pending_deletion';
  uuid: string;
  code?: string;
};
export type SentryAppAvatarPhotoType = 'icon' | 'logo';
export type SentryAppWebhookRequest = {
  date: string;
  eventType: string;
  responseCode: number;
  sentryAppSlug: string;
  webhookUrl: string;
  errorUrl?: string;
  organization?: {
    id: string;
    name: string;
    slug: string;
  };
};
/**
 * Organization Integrations
 */
export type IntegrationType = 'document' | 'plugin' | 'first_party' | 'sentry_app';
export type IntegrationFeature = {
  description: string;
  featureGate: string;
  featureId: number;
};
export type IntegrationDialog = {
  actionText: string;
  body: string;
};
export interface BaseIntegrationProvider {
  canAdd: boolean;
  canDisable: boolean;
  features: string[];
  key: string;
  name: string;
  slug: string;
}
export type ConfigData = Record<string, unknown> & {
  installationType?: string;
};
/**
 * Integration & External issue links
 */
export type IntegrationExternalIssue = {
  description: string;
  displayName: string;
  id: string;
  key: string;
  title: string;
  url: string;
};
export type PlatformExternalIssue = {
  displayName: string;
  id: string;
  issueId: string;
  serviceType: string;
  webUrl: string;
};
export type ExternalIssue = {
  description: string;
  displayName: string;
  id: string;
  integrationKey: string;
  integrationName: string;
  key: string;
  title: string;
};
/**
 * Project Plugins
 */
export type PluginNoProject = {
  canDisable: boolean;
  // TODO(ts)
  contexts: any[];
  doc: string;
  featureDescriptions: IntegrationFeature[];
  features: string[];
  hasConfiguration: boolean;
  id: string;
  isDeprecated: boolean;
  isHidden: boolean;
  isTestable: boolean;
  metadata: any;
  name: string;
  shortName: string;
  slug: string;
  status: string;
  type: string;
  altIsSentryApp?: boolean;
  author?: {name: string; url: string};
  deprecationDate?: string;
  description?: string;
  firstPartyAlternative?: string;
  issue?: {
    issue_id: string;
    // TODO(TS): Label can be an object, unknown shape
    label: string | any;
    url: string;
  };
  resourceLinks?: Array<{title: string; url: string}>;
  version?: string;
};
export type Plugin = PluginNoProject & {
  enabled: boolean;
};
export type WebhookEvent = 'issue' | 'error' | 'comment' | 'seer' | 'preprod_artifact';
export type CodeownersFile = {
  filepath: string;
  html_url: string;
  raw: string;
};
type RepoName = string;
type FileName = string;
export type FilesByRepository = Record<
  RepoName,
  Record<
    FileName,
    {
      authors?: Record<string, CommitAuthor>;
      types?: Set<string>;
    }
  >
>;
interface BaseRepositoryProjectPathConfig {
  id: string;
  projectId: string;
  projectSlug: string;
  repoId: string;
  repoName: string;
  sourceRoot: string;
  stackRoot: string;
  defaultBranch?: string;
}
export interface RepositoryProjectPathConfig extends BaseRepositoryProjectPathConfig {
  integrationId: string | null;
  provider: BaseIntegrationProvider | null;
}
export interface RepositoryProjectPathConfigWithIntegration extends BaseRepositoryProjectPathConfig {
  integrationId: string;
  provider: BaseIntegrationProvider;
}
export type ServerlessFunction = {
  enabled: boolean;
  name: string;
  outOfDate: boolean;
  runtime: string;
  version: number;
};

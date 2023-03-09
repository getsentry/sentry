import type {Alert} from 'sentry/components/alert';
import type {Field} from 'sentry/components/forms/types';
import type {PlatformKey} from 'sentry/data/platformCategories';
import type {
  DISABLED as DISABLED_STATUS,
  INSTALLED,
  NOT_INSTALLED,
  PENDING,
} from 'sentry/views/settings/organizationIntegrations/constants';

import type {Avatar, Choice, Choices, ObjectStatus, Scope} from './core';
import type {ParsedOwnershipRule} from './group';
import type {BaseRelease} from './release';
import type {User} from './user';

export type PermissionValue = 'no-access' | 'read' | 'write' | 'admin';

export type Permissions = {
  Event: PermissionValue;
  Member: PermissionValue;
  Organization: PermissionValue;
  Project: PermissionValue;
  Release: PermissionValue;
  Team: PermissionValue;
};

export type PermissionResource = keyof Permissions;

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
  /**
   * ex - getsentry/sentry
   */
  identifier: string;
  name: string;
  defaultBranch?: string | null;
};

export type Commit = {
  dateCreated: string;
  id: string;
  message: string | null;
  releases: BaseRelease[];
  author?: User;
  pullRequest?: PullRequest | null;
  repository?: Repository;
  suspectCommitType?: string;
};

export type Committer = {
  author: User;
  commits: Commit[];
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
  externalUrl: string;
  id: string;
  repository: Repository;
  title: string;
};

/**
 * Sentry Apps
 */
export type SentryAppStatus = 'unpublished' | 'published' | 'internal';

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
  params?: Array<string>;
};

export enum Coverage {
  NOT_APPLICABLE = -1,
  COVERED = 0,
  NOT_COVERED = 1,
  PARTIAL = 2,
}
export type LineCoverage = [lineNo: number, coverage: Coverage];

export enum CodecovStatusCode {
  COVERAGE_EXISTS = 200,
  NO_INTEGRATION = 404,
  NO_COVERAGE_DATA = 400,
}

export interface CodecovResponse {
  status: CodecovStatusCode;
  attemptedUrl?: string;
  coverageUrl?: string;
  lineCoverage?: LineCoverage[];
}

export type StacktraceLinkResult = {
  integrations: Integration[];
  attemptedUrl?: string;
  codecov?: CodecovResponse;
  config?: RepositoryProjectPathConfigWithIntegration;
  error?: StacktraceErrorMessage;
  sourceUrl?: string;
};

export type StacktraceErrorMessage =
  | 'file_not_found'
  | 'stack_root_mismatch'
  | 'integration_link_forbidden';

export type SentryAppSchemaElement =
  | SentryAppSchemaIssueLink
  | SentryAppSchemaStacktraceLink;

export type SentryApp = {
  author: string;
  events: WebhookEvent[];
  featureData: IntegrationFeature[];
  isAlertable: boolean;
  name: string;
  overview: string | null;
  // possible null params
  popularity: number | null;
  redirectUrl: string | null;
  schema: {
    elements?: SentryAppSchemaElement[];
  };
  scopes: Scope[];
  slug: string;
  status: SentryAppStatus;
  uuid: string;
  verifyInstall: boolean;
  webhookUrl: string | null;
  avatars?: Avatar[];
  clientId?: string;
  clientSecret?: string;
  // optional params below
  datePublished?: string;
  owner?: {
    id: number;
    slug: string;
  };
};

// Minimal Sentry App representation for use with avatars
export type AvatarSentryApp = {
  name: string;
  slug: string;
  uuid: string;
  avatars?: Avatar[];
};

export type SentryAppInstallation = {
  app: {
    slug: string;
    uuid: string;
  };
  organization: {
    slug: string;
  };
  status: 'installed' | 'pending';
  uuid: string;
  code?: string;
};

export type SentryAppComponent = {
  schema: SentryAppSchemaStacktraceLink;
  sentryApp: {
    avatars: Avatar[];
    name: string;
    slug: string;
    uuid: string;
  };
  type: 'issue-link' | 'alert-rule-action' | 'issue-media' | 'stacktrace-link';
  uuid: string;
  error?: boolean;
};

export type SentryAppWebhookRequest = {
  date: string;
  eventType: string;
  responseCode: number;
  sentryAppSlug: string;
  webhookUrl: string;
  errorUrl?: string;
  organization?: {
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

export type IntegrationInstallationStatus =
  | typeof INSTALLED
  | typeof NOT_INSTALLED
  | typeof PENDING
  | typeof DISABLED_STATUS;

type IntegrationDialog = {
  actionText: string;
  body: string;
};

export type DocIntegration = {
  author: string;
  description: string;
  isDraft: boolean;
  name: string;
  popularity: number;
  slug: string;
  url: string;
  avatar?: Avatar;
  features?: IntegrationFeature[];
  resources?: Array<{title: string; url: string}>;
};

type IntegrationAspects = {
  alerts?: Array<
    React.ComponentProps<typeof Alert> & {text: string; icon?: string | React.ReactNode}
  >;
  configure_integration?: {
    title: string;
  };
  disable_dialog?: IntegrationDialog;
  externalInstall?: {
    buttonText: string;
    noticeText: string;
    url: string;
  };
  removal_dialog?: IntegrationDialog;
};

interface BaseIntegrationProvider {
  canAdd: boolean;
  canDisable: boolean;
  features: string[];
  key: string;
  name: string;
  slug: string;
}

export interface IntegrationProvider extends BaseIntegrationProvider {
  metadata: {
    aspects: IntegrationAspects;
    author: string;
    description: string;
    features: IntegrationFeature[];
    issue_url: string;
    noun: string;
    source_url: string;
  };
  setupDialog: {height: number; url: string; width: number};
}

export interface OrganizationIntegrationProvider extends BaseIntegrationProvider {
  aspects: IntegrationAspects;
}

export interface Integration {
  accountType: string;
  domainName: string;
  gracePeriodEnd: string;
  icon: string;
  id: string;
  name: string;
  organizationIntegrationStatus: ObjectStatus;
  provider: OrganizationIntegrationProvider;
  status: ObjectStatus;
  dynamicDisplayInformation?: {
    configure_integration?: {
      instructions: string[];
    };
    integration_detail?: {
      uninstallationUrl?: string;
    };
  };
  scopes?: string[];
}

type ConfigData = {
  installationType?: string;
};

export type OrganizationIntegration = {
  accountType: string | null;
  configData: ConfigData | null;
  configOrganization: Field[];
  domainName: string | null;
  externalId: string;
  gracePeriodEnd: string;
  icon: string | null;
  id: string;
  name: string;
  organizationId: string;
  organizationIntegrationStatus: ObjectStatus;
  provider: OrganizationIntegrationProvider;
  status: ObjectStatus;
};

// we include the configOrganization when we need it
export interface IntegrationWithConfig extends Integration {
  configData: ConfigData;
  configOrganization: Field[];
}

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

export interface GroupIntegration extends Integration {
  externalIssues: IntegrationExternalIssue[];
}

export type PlatformExternalIssue = {
  displayName: string;
  id: string;
  issueId: string;
  serviceType: string;
  webUrl: string;
};

/**
 * The issue config form fields we get are basically the form fields we use in
 * the UI but with some extra information. Some fields marked optional in the
 * form field are guaranteed to exist so we can mark them as required here
 */
export type IssueConfigField = Field & {
  name: string;
  choices?: Choices;
  default?: string | number | Choice;
  multiple?: boolean;
  url?: string;
};

export type IntegrationIssueConfig = {
  domainName: string;
  icon: string[];
  name: string;
  provider: IntegrationProvider;
  status: ObjectStatus;
  createIssueConfig?: IssueConfigField[];
  linkIssueConfig?: IssueConfigField[];
};

/**
 * Project Plugins
 */
export type PluginNoProject = {
  assets: Array<{url: string}>;
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
  // TODO(ts)
  status: string;
  type: string;
  altIsSentryApp?: boolean;
  author?: {name: string; url: string};
  deprecationDate?: string;
  description?: string;
  firstPartyAlternative?: string;
  resourceLinks?: Array<{title: string; url: string}>;
  version?: string;
};

export type Plugin = PluginNoProject & {
  enabled: boolean;
};

export type PluginProjectItem = {
  configured: boolean;
  enabled: boolean;
  projectId: string;
  projectName: string;
  projectPlatform: PlatformKey;
  projectSlug: string;
};

export type PluginWithProjectList = PluginNoProject & {
  projectList: PluginProjectItem[];
};

export type AppOrProviderOrPlugin =
  | SentryApp
  | IntegrationProvider
  | PluginWithProjectList
  | DocIntegration;

/**
 * Webhooks and servicehooks
 */
export type WebhookEvent = 'issue' | 'error' | 'comment';

export type ServiceHook = {
  dateCreated: string;
  events: string[];
  id: string;
  secret: string;
  status: string;
  url: string;
};

/**
 * Codeowners and repository path mappings.
 */
export type CodeOwner = {
  codeMappingId: string;
  dateCreated: string;
  dateUpdated: string;
  errors: {
    missing_external_teams: string[];
    missing_external_users: string[];
    missing_user_emails: string[];
    teams_without_access: string[];
    users_without_access: string[];
  };
  id: string;
  provider: 'github' | 'gitlab';
  raw: string;
  codeMapping?: RepositoryProjectPathConfig;
  ownershipSyntax?: string;
  schema?: {rules: ParsedOwnershipRule[]; version: number};
};

export type CodeownersFile = {
  filepath: string;
  html_url: string;
  raw: string;
};

export type FilesByRepository = {
  [repoName: string]: {
    authors?: {[email: string]: CommitAuthor};
    types?: Set<string>;
  };
};

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

export interface RepositoryProjectPathConfigWithIntegration
  extends BaseRepositoryProjectPathConfig {
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

export type SentryFunction = {
  author: string;
  code: string;
  name: string;
  slug: string;
  env_variables?: Array<{
    name: string;
    value: string;
  }>;
  events?: string[];
  overview?: string;
};

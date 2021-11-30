import Alert from 'sentry/components/alert';
import {PlatformKey} from 'sentry/data/platformCategories';
import {
  INSTALLED,
  NOT_INSTALLED,
  PENDING,
} from 'sentry/views/organizationIntegrations/constants';
import {Field} from 'sentry/views/settings/components/forms/type';

import {Choices, ObjectStatus, Scope} from './core';
import {BaseRelease} from './release';
import {User} from './user';

export type PermissionValue = 'no-access' | 'read' | 'write' | 'admin';

export type Permissions = {
  Event: PermissionValue;
  Member: PermissionValue;
  Organization: PermissionValue;
  Project: PermissionValue;
  Release: PermissionValue;
  Team: PermissionValue;
};

export type ExternalActorMapping = {
  id: string;
  externalName: string;
  userId?: string;
  teamId?: string;
  sentryName: string;
};

export type ExternalUser = {
  id: string;
  memberId: string;
  externalName: string;
  provider: string;
  integrationId: string;
};

export type ExternalTeam = {
  id: string;
  teamId: string;
  externalName: string;
  provider: string;
  integrationId: string;
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

export type Commit = {
  id: string;
  message: string | null;
  dateCreated: string;
  releases: BaseRelease[];
  repository?: Repository;
  author?: User;
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
  id: string;
  author: CommitAuthor;
  commitMessage: string;
  filename: string;
  orgId: number;
  repoName: string;
  type: string;
};

export type PullRequest = {
  id: string;
  title: string;
  externalUrl: string;
  repository: Repository;
};

/**
 * Sentry Apps
 */
export type SentryAppStatus = 'unpublished' | 'published' | 'internal';

export type SentryAppSchemaIssueLink = {
  type: 'issue-link';
  create: {
    uri: string;
    required_fields: any[];
    optional_fields?: any[];
  };
  link: {
    uri: string;
    required_fields: any[];
    optional_fields?: any[];
  };
};

export type SentryAppSchemaStacktraceLink = {
  type: 'stacktrace-link';
  uri: string;
  url: string;
  params?: Array<string>;
};

export type SentryAppSchemaElement =
  | SentryAppSchemaIssueLink
  | SentryAppSchemaStacktraceLink;

export type SentryApp = {
  status: SentryAppStatus;
  scopes: Scope[];
  isAlertable: boolean;
  verifyInstall: boolean;
  slug: string;
  name: string;
  uuid: string;
  author: string;
  events: WebhookEvent[];
  schema: {
    elements?: SentryAppSchemaElement[];
  };
  // possible null params
  popularity: number | null;
  webhookUrl: string | null;
  redirectUrl: string | null;
  overview: string | null;
  // optional params below
  datePublished?: string;
  clientId?: string;
  clientSecret?: string;
  owner?: {
    id: number;
    slug: string;
  };
  featureData: IntegrationFeature[];
};

export type SentryAppInstallation = {
  app: {
    uuid: string;
    slug: string;
  };
  organization: {
    slug: string;
  };
  uuid: string;
  status: 'installed' | 'pending';
  code?: string;
};

export type SentryAppComponent = {
  uuid: string;
  type: 'issue-link' | 'alert-rule-action' | 'issue-media' | 'stacktrace-link';
  schema: SentryAppSchemaStacktraceLink;
  sentryApp: {
    uuid: string;
    slug:
      | 'calixa'
      | 'clickup'
      | 'komodor'
      | 'linear'
      | 'rookout'
      | 'shortcut'
      | 'spikesh'
      | 'taskcall'
      | 'teamwork';
    name: string;
  };
};

export type SentryAppWebhookRequest = {
  webhookUrl: string;
  sentryAppSlug: string;
  eventType: string;
  date: string;
  organization?: {
    slug: string;
    name: string;
  };
  responseCode: number;
  errorUrl?: string;
};

/**
 * Organization Integrations
 */
export type IntegrationType = 'document' | 'plugin' | 'first_party' | 'sentry_app';

export type IntegrationFeature = {
  description: string;
  featureGate: string;
};

export type IntegrationInstallationStatus =
  | typeof INSTALLED
  | typeof NOT_INSTALLED
  | typeof PENDING;

type IntegrationDialog = {
  actionText: string;
  body: string;
};

export type DocumentIntegration = {
  slug: string;
  name: string;
  author: string;
  docUrl: string;
  description: string;
  features: IntegrationFeature[];
  resourceLinks: Array<{title: string; url: string}>;
};

type IntegrationAspects = {
  alerts?: Array<React.ComponentProps<typeof Alert> & {text: string}>;
  disable_dialog?: IntegrationDialog;
  removal_dialog?: IntegrationDialog;
  externalInstall?: {
    url: string;
    buttonText: string;
    noticeText: string;
  };
  configure_integration?: {
    title: string;
  };
};

type BaseIntegrationProvider = {
  key: string;
  slug: string;
  name: string;
  canAdd: boolean;
  canDisable: boolean;
  features: string[];
};

export type IntegrationProvider = BaseIntegrationProvider & {
  setupDialog: {url: string; width: number; height: number};
  metadata: {
    description: string;
    features: IntegrationFeature[];
    author: string;
    noun: string;
    issue_url: string;
    source_url: string;
    aspects: IntegrationAspects;
  };
};

export type Integration = {
  id: string;
  name: string;
  icon: string;
  domainName: string;
  accountType: string;
  scopes?: string[];
  status: ObjectStatus;
  provider: BaseIntegrationProvider & {aspects: IntegrationAspects};
  dynamicDisplayInformation?: {
    configure_integration?: {
      instructions: string[];
    };
    integration_detail?: {
      uninstallationUrl?: string;
    };
  };
};

// we include the configOrganization when we need it
export type IntegrationWithConfig = Integration & {
  configOrganization: Field[];
  configData: object | null;
};

/**
 * Integration & External issue links
 */
export type IntegrationExternalIssue = {
  id: string;
  key: string;
  url: string;
  title: string;
  description: string;
  displayName: string;
};

export type GroupIntegration = Integration & {
  externalIssues: IntegrationExternalIssue[];
};

export type PlatformExternalIssue = {
  id: string;
  issueId: string;
  serviceType: string;
  displayName: string;
  webUrl: string;
};

/**
 * The issue config form fields we get are basically the form fields we use in
 * the UI but with some extra information. Some fields marked optional in the
 * form field are guaranteed to exist so we can mark them as required here
 */
export type IssueConfigField = Field & {
  name: string;
  default?: string | number;
  choices?: Choices;
  url?: string;
  multiple?: boolean;
};

export type IntegrationIssueConfig = {
  status: ObjectStatus;
  name: string;
  domainName: string;
  linkIssueConfig?: IssueConfigField[];
  createIssueConfig?: IssueConfigField[];
  provider: IntegrationProvider;
  icon: string[];
};

/**
 * Project Plugins
 */
export type PluginNoProject = {
  id: string;
  name: string;
  slug: string;
  shortName: string;
  type: string;
  canDisable: boolean;
  isTestable: boolean;
  hasConfiguration: boolean;
  metadata: any; // TODO(ts)
  contexts: any[]; // TODO(ts)
  status: string;
  assets: Array<{url: string}>;
  doc: string;
  features: string[];
  featureDescriptions: IntegrationFeature[];
  isHidden: boolean;
  version?: string;
  author?: {name: string; url: string};
  description?: string;
  resourceLinks?: Array<{title: string; url: string}>;
  altIsSentryApp?: boolean;
  deprecationDate?: string;
  firstPartyAlternative?: string;
};

export type Plugin = PluginNoProject & {
  enabled: boolean;
};

export type PluginProjectItem = {
  projectId: string;
  projectSlug: string;
  projectName: string;
  projectPlatform: PlatformKey;
  enabled: boolean;
  configured: boolean;
};

export type PluginWithProjectList = PluginNoProject & {
  projectList: PluginProjectItem[];
};

export type AppOrProviderOrPlugin =
  | SentryApp
  | IntegrationProvider
  | PluginWithProjectList
  | DocumentIntegration;

/**
 * Webhooks and servicehooks
 */
export type WebhookEvent = 'issue' | 'error';

export type ServiceHook = {
  id: string;
  events: string[];
  dateCreated: string;
  secret: string;
  status: string;
  url: string;
};

/**
 * Codeowners and repository path mappings.
 */
export type CodeOwner = {
  id: string;
  raw: string;
  dateCreated: string;
  dateUpdated: string;
  provider: 'github' | 'gitlab';
  codeMapping?: RepositoryProjectPathConfig;
  codeMappingId: string;
  ownershipSyntax?: string;
  errors: {
    missing_external_teams: string[];
    missing_external_users: string[];
    missing_user_emails: string[];
    teams_without_access: string[];
    users_without_access: string[];
  };
};

export type CodeownersFile = {
  raw: string;
  filepath: string;
  html_url: string;
};

export type FilesByRepository = {
  [repoName: string]: {
    authors?: {[email: string]: CommitAuthor};
    types?: Set<string>;
  };
};

type BaseRepositoryProjectPathConfig = {
  id: string;
  projectId: string;
  projectSlug: string;
  repoId: string;
  repoName: string;
  stackRoot: string;
  sourceRoot: string;
  defaultBranch?: string;
};

export type RepositoryProjectPathConfig = BaseRepositoryProjectPathConfig & {
  integrationId: string | null;
  provider: BaseIntegrationProvider | null;
};

export type RepositoryProjectPathConfigWithIntegration =
  BaseRepositoryProjectPathConfig & {
    integrationId: string;
    provider: BaseIntegrationProvider;
  };

export type ServerlessFunction = {
  name: string;
  runtime: string;
  version: number;
  outOfDate: boolean;
  enabled: boolean;
};

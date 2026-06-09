import type {AlertProps} from '@sentry/scraps/alert';

import type {JsonFormAdapterFieldConfig} from 'sentry/components/backendJsonFormAdapter/types';
import type {Field} from 'sentry/components/forms/types';
import type {
  BaseIntegrationProvider,
  ConfigData,
  IntegrationDialog,
  IntegrationExternalIssue,
  IntegrationFeature,
  PluginNoProject,
  PullRequest,
  Repository,
  RepositoryProjectPathConfig,
  RepositoryProjectPathConfigWithIntegration,
  SentryAppAvatarPhotoType,
  SentryAppSchemaElement,
  SentryAppSchemaStacktraceLink,
  SentryAppStatus,
  StacktraceErrorMessage,
  WebhookEvent,
} from 'sentry/types/integrationsBase';
import type {CodeReviewTrigger} from 'sentry/types/seer';
import type {
  DISABLED as DISABLED_STATUS,
  INSTALLED,
  NOT_INSTALLED,
  PENDING,
  PENDING_DELETION,
} from 'sentry/views/settings/organizationIntegrations/constants';

import type {Avatar, Choice, Choices, ObjectStatus, Scope} from './core';
import type {ParsedOwnershipRule} from './ownership';
import type {PlatformKey} from './platform';
import type {BaseRelease} from './release';
import type {User} from './user';

export type {
  PermissionValue,
  Permissions,
  PermissionResource,
} from 'sentry/types/permissions';

/**
 * Available only when calling API with `expand=settings` query parameter
 */
export interface RepositoryWithSettings extends Repository {
  settings: null | {
    codeReviewTriggers: CodeReviewTrigger[];
    enabledCodeReview: boolean;
  };
}

export const DEFAULT_CODE_REVIEW_TRIGGERS: CodeReviewTrigger[] = ['on_ready_for_review'];

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
  /**
   * Primary key of the GroupOwner record that linked this committer to the issue.
   * Used for suspect commit feedback analytics.
   */
  group_owner_id?: number;
};

export interface StacktraceLinkResult {
  integrations: Integration[];
  attemptedUrl?: string;
  config?: RepositoryProjectPathConfigWithIntegration;
  error?: StacktraceErrorMessage;
  sourceUrl?: string;
}

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
  allowedOrigins?: string[];
  avatars?: SentryAppAvatar[];
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

export type SentryAppComponent<
  Schema extends SentryAppSchemaStacktraceLink | SentryAppSchemaElement =
    | SentryAppSchemaStacktraceLink
    | SentryAppSchemaElement,
> = {
  schema: Schema;
  sentryApp: {
    avatars: Avatar[];
    name: string;
    slug: string;
    uuid: string;
  };
  type: 'issue-link' | 'alert-rule-action' | 'issue-media' | 'stacktrace-link';
  uuid: string;
  error?: string | boolean;
};

export type SentryAppAvatar = Avatar & {
  photoType: SentryAppAvatarPhotoType;
};

export type IntegrationInstallationStatus =
  | typeof INSTALLED
  | typeof NOT_INSTALLED
  | typeof PENDING
  | typeof DISABLED_STATUS
  | typeof PENDING_DELETION;

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
  // This was previously passed to us
  alerts?: Array<
    unknown & {
      text: string;
      icon?: string | React.ReactNode;
      variant?: AlertProps['variant'];
    }
  >;
  configure_integration?: {
    title: string;
  };
  directEnable?: boolean;
  disable_dialog?: IntegrationDialog;
  externalInstall?: {
    buttonText: string;
    noticeText: string;
    url: string;
  };
  removal_dialog?: IntegrationDialog;
};

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

interface OrganizationIntegrationProvider extends BaseIntegrationProvider {
  aspects: IntegrationAspects;
}

interface CommonIntegration {
  accountType: string | null;
  domainName: string | null;
  gracePeriodEnd: string | null;
  icon: string | null;
  id: string;
  name: string;
  organizationIntegrationStatus: ObjectStatus;
  provider: OrganizationIntegrationProvider;
  status: ObjectStatus;
}

export interface Integration extends CommonIntegration {
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

export interface OrganizationIntegration extends Integration {
  configData: ConfigData | null;
  configOrganization: JsonFormAdapterFieldConfig[];
  externalId: string;
  organizationId: string;
}

// we include the configOrganization when we need it
export interface IntegrationWithConfig extends Integration {
  configData: ConfigData;
  configOrganization: JsonFormAdapterFieldConfig[];
}

export interface GroupIntegration extends Integration {
  externalIssues: IntegrationExternalIssue[];
}

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
 * Codeowners and repository path mappings.
 */
export type CodeOwner = {
  codeMappingId: string;
  /**
   * Link to the CODEOWNERS file in source control
   * 'unknown' if the api fails to fetch the file
   */
  codeOwnersUrl: string | 'unknown';
  dateCreated: string;
  dateSynced: string | null;
  dateUpdated: string;
  errors: {
    missing_external_teams: string[];
    missing_external_users: string[];
    missing_user_emails: string[];
    teams_without_access: string[];
    users_without_access: string[];
  };
  id: string;
  provider: 'github' | 'gitlab' | 'perforce';
  raw: string;
  codeMapping?: RepositoryProjectPathConfig;
  ownershipSyntax?: string;
  schema?: {rules: ParsedOwnershipRule[]; version: number};
};

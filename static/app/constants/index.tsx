/* global process */

import {t} from 'sentry/locale';
import type {DataCategoryInfo, Scope} from 'sentry/types/core';
import {DataCategory, DataCategoryExact} from 'sentry/types/core';
import type {PermissionResource} from 'sentry/types/integrations';
import type {Organization, OrgRole} from 'sentry/types/organization';

/**
 * Common constants here
 */

// This is the element id where we render our React application to
export const ROOT_ELEMENT = 'blk_router';

export const USING_CUSTOMER_DOMAIN =
  typeof window === 'undefined' ? false : Boolean(window?.__initialData?.customerDomain);

export const CUSTOMER_DOMAIN =
  typeof window === 'undefined'
    ? undefined
    : window?.__initialData?.customerDomain?.subdomain;

// Constant used for tracking referrer in session storage rather than
// ?referrer=foo get parameter:
export const CUSTOM_REFERRER_KEY = 'customReferrer';

// This is considered the "default" route/view that users should be taken
// to when the application does not have any further context
//
// e.g. loading app root or switching organization
export const DEFAULT_APP_ROUTE = USING_CUSTOMER_DOMAIN
  ? '/issues/'
  : '/organizations/:orgSlug/issues/';

export const API_ACCESS_SCOPES = [
  'alerts:read',
  'alerts:write',
  'event:admin',
  'event:read',
  'event:write',
  'member:admin',
  'member:read',
  'member:write',
  'org:admin',
  'org:integrations',
  'org:read',
  'org:write',
  'project:admin',
  'project:distribution',
  'project:read',
  'project:releases',
  'project:write',
  'team:admin',
  'team:read',
  'team:write',
] as const;

export const ALLOWED_SCOPES = [
  'alerts:read',
  'alerts:write',
  'event:admin',
  'event:read',
  'event:write',
  'member:admin',
  'member:invite',
  'member:read',
  'member:write',
  'org:admin',
  'org:billing',
  'org:integrations',
  'org:read',
  'org:superuser', // not an assignable API access scope
  'org:write',
  'project:admin',
  'project:distribution',
  'project:read',
  'project:releases',
  'project:write',
  'team:admin',
  'team:read',
  'team:write',
] as const;

// These should only be used in the case where we cannot obtain roles through
// the members endpoint (primarily in cases where a user is admining a
// different organization they are not a OrganizationMember of ).
export const ORG_ROLES: OrgRole[] = [
  {
    id: 'member',
    name: 'Member',
    isAllowed: true,
    desc: 'Members can view and act on events, as well as view most other data within the organization.',
    minimumTeamRole: 'contributor',
    isTeamRolesAllowed: true,
  },
  {
    id: 'admin',
    name: 'Admin',
    isAllowed: true,
    desc: "Admin privileges on any teams of which they're a member. They can create new teams and projects, as well as remove teams and projects on which they already hold membership (or all teams, if open membership is enabled). Additionally, they can manage memberships of teams that they are members of. They cannot invite members to the organization.",
    minimumTeamRole: 'admin',
    isTeamRolesAllowed: true,
  },
  {
    id: 'manager',
    name: 'Manager',
    isAllowed: true,
    desc: 'Gains admin access on all teams as well as the ability to add and remove members.',
    minimumTeamRole: 'admin',
    isTeamRolesAllowed: true,
  },
  {
    id: 'owner',
    name: 'Organization Owner',
    isAllowed: true,
    desc: 'Unrestricted access to the organization, its data, and its settings. Can add, modify, and delete projects and members, as well as make billing and plan changes.',
    minimumTeamRole: 'admin',
    isTeamRolesAllowed: true,
  },
];

type PermissionChoice = {
  label: 'No Access' | 'Read' | 'Read & Write' | 'Admin';
  scopes: Scope[];
};

export type PermissionObj = {
  choices: {
    'no-access': PermissionChoice;
    admin?: PermissionChoice;
    read?: PermissionChoice;
    write?: PermissionChoice;
  };
  help: string;
  resource: PermissionResource;
  label?: string;
};

export const RELEASE_ADOPTION_STAGES = ['low_adoption', 'adopted', 'replaced'];

// We expose permissions for Sentry Apps in a more resource-centric way.
// All of the API_ACCESS_SCOPES from above should be represented in a more
// User-friendly way here.
export const SENTRY_APP_PERMISSIONS: PermissionObj[] = [
  {
    resource: 'Project',
    help: 'Projects, Tags, Debug Files, and Feedback',
    choices: {
      'no-access': {label: 'No Access', scopes: []},
      read: {label: 'Read', scopes: ['project:read']},
      write: {label: 'Read & Write', scopes: ['project:read', 'project:write']},
      admin: {label: 'Admin', scopes: ['project:read', 'project:write', 'project:admin']},
    },
  },
  {
    resource: 'Team',
    help: 'Teams of members',
    choices: {
      'no-access': {label: 'No Access', scopes: []},
      read: {label: 'Read', scopes: ['team:read']},
      write: {label: 'Read & Write', scopes: ['team:read', 'team:write']},
      admin: {label: 'Admin', scopes: ['team:read', 'team:write', 'team:admin']},
    },
  },
  {
    resource: 'Release',
    help: 'Releases, Commits, and related Files',
    choices: {
      'no-access': {label: 'No Access', scopes: []},
      admin: {label: 'Admin', scopes: ['project:releases']},
    },
  },
  {
    resource: 'Distribution',
    help: 'Pre-release app distribution for trusted testers.',
    choices: {
      'no-access': {label: 'No Access', scopes: []},
      read: {label: 'Read', scopes: ['project:distribution']},
    },
  },
  {
    resource: 'Event',
    label: 'Issue & Event',
    help: 'Issues, Events, and workflow statuses',
    choices: {
      'no-access': {label: 'No Access', scopes: []},
      read: {label: 'Read', scopes: ['event:read']},
      write: {label: 'Read & Write', scopes: ['event:read', 'event:write']},
      admin: {label: 'Admin', scopes: ['event:read', 'event:write', 'event:admin']},
    },
  },
  {
    resource: 'Organization',
    help: 'Manage Organizations, resolve IDs, retrieve Repositories and Commits',
    choices: {
      'no-access': {label: 'No Access', scopes: []},
      read: {label: 'Read', scopes: ['org:read']},
      write: {label: 'Read & Write', scopes: ['org:read', 'org:write']},
      admin: {
        label: 'Admin',
        scopes: ['org:read', 'org:write', 'org:admin', 'org:integrations'],
      },
    },
  },
  {
    resource: 'Member',
    help: 'Manage Members within Teams',
    choices: {
      'no-access': {label: 'No Access', scopes: []},
      read: {label: 'Read', scopes: ['member:read']},
      write: {label: 'Read & Write', scopes: ['member:read', 'member:write']},
      admin: {label: 'Admin', scopes: ['member:read', 'member:write', 'member:admin']},
    },
  },
  {
    resource: 'Alerts',
    help: 'Manage Alerts',
    choices: {
      'no-access': {label: 'No Access', scopes: []},
      read: {label: 'Read', scopes: ['alerts:read']},
      write: {label: 'Read & Write', scopes: ['alerts:read', 'alerts:write']},
    },
  },
];

export const DEFAULT_TOAST_DURATION = 6000;
export const DEFAULT_DEBOUNCE_DURATION = 300;

export const ALL_ENVIRONMENTS_KEY = '__all_environments__';

export const MENU_CLOSE_DELAY = 200;

export const SLOW_TOOLTIP_DELAY = 1000;

export const MAX_PICKABLE_DAYS = 90;

export const DEFAULT_STATS_PERIOD = '14d';

export const TAXONOMY_DEFAULT_QUERY = 'is:unresolved';

export const DEFAULT_RELATIVE_PERIODS = {
  '1h': t('Last hour'),
  '24h': t('Last 24 hours'),
  '7d': t('Last 7 days'),
  '14d': t('Last 14 days'),
  '30d': t('Last 30 days'),
  '90d': t('Last 90 days'),
};

const DEFAULT_STATS_INFO = {
  showExternalStats: false,
  showInternalStats: true,
  yAxisMinInterval: 10,
};
const GIGABYTE = 10 ** 9;
const KILOBYTE = 10 ** 3;
const MILLISECONDS_IN_HOUR = 3_600_000;

/**
 * Default formatting configuration for count-based categories.
 * Most categories use this configuration.
 */
const DEFAULT_COUNT_FORMATTING = {
  unitType: 'count' as const,
  reservedMultiplier: 1,
  bigNumUnit: 0 as const,
  priceFormatting: {minIntegerDigits: 5, maxIntegerDigits: 7},
  projectedAbbreviated: true,
};

/**
 * Formatting configuration for byte-based categories (attachments, logs).
 * Reserved values are in GB, raw values are in bytes.
 */
const BYTES_FORMATTING = {
  unitType: 'bytes' as const,
  reservedMultiplier: GIGABYTE,
  bigNumUnit: 1 as const,
  priceFormatting: {minIntegerDigits: 2, maxIntegerDigits: 2},
  projectedAbbreviated: true,
};

/**
 * Formatting configuration for duration-based categories (continuous profiling).
 * Reserved values are in hours, raw values are in milliseconds.
 */
const DURATION_HOURS_FORMATTING = {
  unitType: 'durationHours' as const,
  reservedMultiplier: MILLISECONDS_IN_HOUR,
  bigNumUnit: 0 as const,
  priceFormatting: {minIntegerDigits: 5, maxIntegerDigits: 7},
  projectedAbbreviated: true,
};

// https://github.com/getsentry/relay/blob/master/relay-base-schema/src/data_category.rs
export const DATA_CATEGORY_INFO = {
  [DataCategoryExact.ERROR]: {
    name: DataCategoryExact.ERROR,
    plural: DataCategory.ERRORS,
    singular: 'error',
    displayName: 'error',
    titleName: t('Errors'),
    productName: t('Error Monitoring'),
    uid: 1,
    isBilledCategory: true,
    docsUrl: 'https://docs.sentry.io/product/sentry-basics/',
    statsInfo: {
      ...DEFAULT_STATS_INFO,
      showExternalStats: true,
    },
    formatting: DEFAULT_COUNT_FORMATTING,
  },
  [DataCategoryExact.TRANSACTION]: {
    name: DataCategoryExact.TRANSACTION,
    plural: DataCategory.TRANSACTIONS,
    singular: 'transaction',
    displayName: 'transaction',
    titleName: t('Transactions'),
    productName: t('Performance Monitoring'),
    uid: 2,
    isBilledCategory: true,
    docsUrl: 'https://docs.sentry.io/product/performance/',
    statsInfo: {
      ...DEFAULT_STATS_INFO,
      showExternalStats: true,
    },
    formatting: DEFAULT_COUNT_FORMATTING,
  },
  [DataCategoryExact.ATTACHMENT]: {
    name: DataCategoryExact.ATTACHMENT,
    plural: DataCategory.ATTACHMENTS,
    singular: 'attachment',
    displayName: 'attachment',
    titleName: t('Attachments'),
    productName: t('Attachments'),
    uid: 4,
    isBilledCategory: true,
    docsUrl: 'https://docs.sentry.io/product/accounts/quotas/manage-attachments-quota/',
    statsInfo: {
      ...DEFAULT_STATS_INFO,
      showExternalStats: true,
      yAxisMinInterval: 0.5 * GIGABYTE,
    },
    formatting: {...BYTES_FORMATTING, projectedAbbreviated: false},
  },
  [DataCategoryExact.PROFILE]: {
    name: DataCategoryExact.PROFILE,
    plural: DataCategory.PROFILES,
    singular: 'profile',
    displayName: 'profile',
    titleName: t('Profiles'),
    productName: t('Continuous Profiling'),
    uid: 6,
    isBilledCategory: false,
    docsUrl: 'https://docs.sentry.io/product/profiling/',
    statsInfo: {
      ...DEFAULT_STATS_INFO,
      showExternalStats: true,
    },
    formatting: DEFAULT_COUNT_FORMATTING,
  },
  [DataCategoryExact.PROFILE_INDEXED]: {
    name: DataCategoryExact.PROFILE_INDEXED,
    plural: DataCategory.PROFILES_INDEXED,
    singular: 'profileIndexed',
    displayName: 'indexed profile',
    titleName: t('Indexed Profiles'),
    productName: t('Continuous Profiling'),
    uid: 11,
    isBilledCategory: false,
    statsInfo: DEFAULT_STATS_INFO,
    formatting: DEFAULT_COUNT_FORMATTING,
  },
  [DataCategoryExact.REPLAY]: {
    name: DataCategoryExact.REPLAY,
    plural: DataCategory.REPLAYS,
    singular: 'replay',
    displayName: 'replay',
    titleName: t('Session Replays'),
    productName: t('Session Replay'),
    uid: 7,
    isBilledCategory: true,
    docsUrl: 'https://docs.sentry.io/product/session-replay/',
    statsInfo: {
      ...DEFAULT_STATS_INFO,
      showExternalStats: true,
    },
    formatting: DEFAULT_COUNT_FORMATTING,
  },
  [DataCategoryExact.USER_REPORT_V2]: {
    name: DataCategoryExact.USER_REPORT_V2,
    plural: DataCategory.USER_REPORT_V2,
    singular: 'feedback',
    displayName: 'user feedback',
    titleName: t('User Feedback'),
    productName: t('User Feedback'),
    uid: 14,
    isBilledCategory: false,
    docsUrl: 'https://docs.sentry.io/product/user-feedback/',
    statsInfo: {
      ...DEFAULT_STATS_INFO,
      showExternalStats: true,
    },
    formatting: DEFAULT_COUNT_FORMATTING,
  },
  [DataCategoryExact.TRANSACTION_PROCESSED]: {
    name: DataCategoryExact.TRANSACTION_PROCESSED,
    plural: DataCategory.TRANSACTIONS_PROCESSED,
    singular: 'transactionProcessed',
    displayName: 'transaction',
    titleName: t('Transactions'),
    productName: t('Performance Monitoring'),
    uid: 8,
    isBilledCategory: false,
    statsInfo: {
      ...DEFAULT_STATS_INFO,
      showInternalStats: false,
    },
    formatting: DEFAULT_COUNT_FORMATTING,
  },
  [DataCategoryExact.TRANSACTION_INDEXED]: {
    name: DataCategoryExact.TRANSACTION_INDEXED,
    plural: DataCategory.TRANSACTIONS_INDEXED,
    singular: 'transactionIndexed',
    displayName: 'indexed transaction',
    titleName: t('Indexed Transactions'),
    productName: t('Performance Monitoring'),
    uid: 9,
    isBilledCategory: false,
    statsInfo: DEFAULT_STATS_INFO,
    formatting: DEFAULT_COUNT_FORMATTING,
  },
  [DataCategoryExact.MONITOR]: {
    name: DataCategoryExact.MONITOR,
    plural: DataCategory.MONITOR,
    singular: 'monitor',
    displayName: 'cron check-in',
    titleName: t('Cron Check-Ins'),
    productName: t('Cron Monitoring'),
    uid: 10,
    isBilledCategory: false,
    statsInfo: {
      ...DEFAULT_STATS_INFO,
      showExternalStats: true,
    },
    formatting: DEFAULT_COUNT_FORMATTING,
  },
  [DataCategoryExact.SPAN]: {
    name: DataCategoryExact.SPAN,
    plural: DataCategory.SPANS,
    singular: 'span',
    displayName: 'span',
    titleName: t('Spans'), // TODO(DS Spans): Update name
    productName: t('Tracing'),
    uid: 12,
    isBilledCategory: true,
    docsUrl: 'https://docs.sentry.io/product/performance/',
    statsInfo: {
      ...DEFAULT_STATS_INFO,
      showExternalStats: true,
    },
    formatting: DEFAULT_COUNT_FORMATTING,
  },
  [DataCategoryExact.MONITOR_SEAT]: {
    name: DataCategoryExact.MONITOR_SEAT,
    plural: DataCategory.MONITOR_SEATS,
    singular: 'monitorSeat',
    displayName: 'cron monitor',
    titleName: t('Cron Monitors'),
    productName: t('Cron Monitoring'),
    uid: 13,
    isBilledCategory: true,
    docsUrl: 'https://docs.sentry.io/product/crons/',
    statsInfo: {
      ...DEFAULT_STATS_INFO,
      showInternalStats: false,
    },
    formatting: DEFAULT_COUNT_FORMATTING,
  },
  [DataCategoryExact.SPAN_INDEXED]: {
    name: DataCategoryExact.SPAN_INDEXED,
    plural: DataCategory.SPANS_INDEXED,
    singular: 'spanIndexed',
    displayName: 'stored span',
    titleName: t('Stored Spans'),
    productName: t('Tracing'),
    uid: 16,
    isBilledCategory: false,
    docsUrl: 'https://docs.sentry.io/product/performance/',
    statsInfo: DEFAULT_STATS_INFO,
    formatting: DEFAULT_COUNT_FORMATTING,
  },
  [DataCategoryExact.PROFILE_DURATION]: {
    name: DataCategoryExact.PROFILE_DURATION,
    plural: DataCategory.PROFILE_DURATION,
    singular: 'profileDuration',
    displayName: 'continuous profile hour',
    titleName: t('Continuous Profile Hours'),
    productName: t('Continuous Profiling'),
    uid: 17,
    isBilledCategory: true,
    docsUrl:
      'https://docs.sentry.io/product/explore/profiling/getting-started/#continuous-profiling',
    statsInfo: {
      ...DEFAULT_STATS_INFO,
      showExternalStats: true,
    },
    formatting: DURATION_HOURS_FORMATTING,
  },
  [DataCategoryExact.PROFILE_CHUNK]: {
    name: DataCategoryExact.PROFILE_CHUNK,
    plural: DataCategory.PROFILE_CHUNKS,
    singular: 'profileChunk',
    displayName: 'profile chunk',
    titleName: t('Profile Chunks'),
    productName: t('Continuous Profiling'),
    uid: 18,
    isBilledCategory: false,
    statsInfo: DEFAULT_STATS_INFO,
    formatting: DEFAULT_COUNT_FORMATTING,
  },
  [DataCategoryExact.PROFILE_DURATION_UI]: {
    name: DataCategoryExact.PROFILE_DURATION_UI,
    plural: DataCategory.PROFILE_DURATION_UI,
    singular: 'profileDurationUI',
    displayName: 'UI profile hour',
    titleName: t('UI Profile Hours'),
    productName: t('UI Profiling'),
    uid: 25,
    isBilledCategory: true,
    docsUrl:
      'https://docs.sentry.io/product/explore/profiling/getting-started/#ui-profiling',
    statsInfo: {
      ...DEFAULT_STATS_INFO,
      showExternalStats: true,
    },
    formatting: DURATION_HOURS_FORMATTING,
  },
  [DataCategoryExact.PROFILE_CHUNK_UI]: {
    name: DataCategoryExact.PROFILE_CHUNK_UI,
    plural: DataCategory.PROFILE_CHUNKS_UI,
    singular: 'profileChunkUI',
    displayName: 'UI profile chunk',
    titleName: t('UI Profile Chunks'),
    productName: t('UI Profiling'),
    uid: 26,
    isBilledCategory: false,
    statsInfo: DEFAULT_STATS_INFO,
    formatting: DEFAULT_COUNT_FORMATTING,
  },

  [DataCategoryExact.UPTIME]: {
    name: DataCategoryExact.UPTIME,
    plural: DataCategory.UPTIME,
    singular: 'uptime',
    displayName: 'uptime monitor',
    titleName: t('Uptime Monitors'),
    productName: t('Uptime Monitoring'),
    uid: 21,
    isBilledCategory: true,
    docsUrl: 'https://docs.sentry.io/product/alerts/uptime-monitoring/',
    statsInfo: {
      ...DEFAULT_STATS_INFO,
      showInternalStats: false,
    },
    formatting: DEFAULT_COUNT_FORMATTING,
  },
  [DataCategoryExact.LOG_ITEM]: {
    name: DataCategoryExact.LOG_ITEM,
    plural: DataCategory.LOG_ITEM,
    singular: 'logItem',
    displayName: 'log',
    titleName: t('Log Counts'), // Only currently visible internally, this name should change if we expose this to users.
    productName: t('Logging'),
    uid: 23,
    isBilledCategory: false,
    statsInfo: {
      ...DEFAULT_STATS_INFO,
      showExternalStats: true,
    },
    formatting: DEFAULT_COUNT_FORMATTING,
  },
  [DataCategoryExact.LOG_BYTE]: {
    name: DataCategoryExact.LOG_BYTE,
    plural: DataCategory.LOG_BYTE,
    singular: 'logByte',
    displayName: 'log byte',
    titleName: t('Logs'),
    productName: t('Logging'),
    uid: 24,
    isBilledCategory: true,
    docsUrl: 'https://docs.sentry.io/product/explore/logs/getting-started/',
    statsInfo: {
      ...DEFAULT_STATS_INFO,
      showExternalStats: true,
      yAxisMinInterval: 1 * KILOBYTE,
    },
    formatting: BYTES_FORMATTING,
  },
  [DataCategoryExact.SEER_AUTOFIX]: {
    name: DataCategoryExact.SEER_AUTOFIX,
    plural: DataCategory.SEER_AUTOFIX,
    singular: 'seerAutofix',
    displayName: 'issue fix',
    titleName: t('Issue Fixes'),
    productName: t('Seer'),
    uid: 27,
    isBilledCategory: true,
    statsInfo: {
      ...DEFAULT_STATS_INFO,
      showExternalStats: true,
    },
    formatting: DEFAULT_COUNT_FORMATTING,
  },
  [DataCategoryExact.SEER_SCANNER]: {
    name: DataCategoryExact.SEER_SCANNER,
    plural: DataCategory.SEER_SCANNER,
    singular: 'seerScanner',
    displayName: 'issue scan',
    titleName: t('Issue Scans'),
    productName: t('Seer'),
    uid: 28,
    isBilledCategory: true,
    statsInfo: {
      ...DEFAULT_STATS_INFO,
      showExternalStats: true,
    },
    formatting: DEFAULT_COUNT_FORMATTING,
  },
  [DataCategoryExact.TRACE_METRIC]: {
    name: DataCategoryExact.TRACE_METRIC,
    plural: DataCategory.TRACE_METRICS,
    singular: 'metric',
    displayName: 'metric',
    titleName: t('Metrics'),
    productName: t('Metrics'),
    uid: 33,
    isBilledCategory: false,
    statsInfo: {
      ...DEFAULT_STATS_INFO,
      showExternalStats: true,
    },
    formatting: DEFAULT_COUNT_FORMATTING,
  },
  [DataCategoryExact.SEER_USER]: {
    name: DataCategoryExact.SEER_USER,
    plural: DataCategory.SEER_USER,
    singular: 'seerUser',
    displayName: 'active contributor',
    titleName: t('Active Contributors'),
    productName: t('Seer'),
    uid: 34,
    isBilledCategory: true,
    statsInfo: {
      ...DEFAULT_STATS_INFO,
      showExternalStats: false, // TODO(seer): add external stats when ready
    },
    getProductLink: (organization: Organization) =>
      `/settings/${organization.slug}/seer/`,
    formatting: DEFAULT_COUNT_FORMATTING,
  },
} as const satisfies Record<DataCategoryExact, DataCategoryInfo>;

// SmartSearchBar settings
export const MAX_AUTOCOMPLETE_RECENT_SEARCHES = 3;

export const DEFAULT_PER_PAGE = 50;

// Webpack configures DEPLOY_PREVIEW_CONFIG for deploy preview builds.
export const DEPLOY_PREVIEW_CONFIG = process.env.DEPLOY_PREVIEW_CONFIG as unknown as
  | undefined
  | false
  | {
      branch: string;
      commitSha: string;
      githubOrg: string;
      githubRepo: string;
    };

// Webpack configures EXPERIMENTAL_SPA.
export const EXPERIMENTAL_SPA = process.env.EXPERIMENTAL_SPA as unknown as
  | undefined
  | boolean;

// so we don't use filtered values in certain display contexts
// TODO(kmclb): once relay is doing the scrubbing, the masking value will be dynamic,
// so this will have to change
export const FILTER_MASK = '[Filtered]';

// Errors that may occur during the fetching of organization details
export const ORGANIZATION_FETCH_ERROR_TYPES = {
  ORG_NOT_FOUND: 'ORG_NOT_FOUND',
  ORG_NO_ACCESS: 'ORG_NO_ACCESS',
  NO_ORGS: 'NO_ORGS',
};

export const CONFIG_DOCS_URL = 'https://develop.sentry.dev/config/';
export const DISCOVER2_DOCS_URL = 'https://docs.sentry.io/product/discover-queries/';
export const SPAN_PROPS_DOCS_URL =
  'https://docs.sentry.io/concepts/search/searchable-properties/spans/';

export const IS_ACCEPTANCE_TEST = !!process.env.IS_ACCEPTANCE_TEST;
export const NODE_ENV = process.env.NODE_ENV;
export const SPA_DSN = process.env.SPA_DSN;
export const SENTRY_RELEASE_VERSION = process.env.SENTRY_RELEASE_VERSION;
export const UI_DEV_ENABLE_PROFILING = process.env.UI_DEV_ENABLE_PROFILING;
export const USE_REACT_QUERY_DEVTOOL = process.env.USE_REACT_QUERY_DEVTOOL;

export const DEFAULT_ERROR_JSON = {
  detail: t('Unknown error. Please try again.'),
};

/**
 * Hardcoded data for the service account creation POC.
 *
 * Scopes come from the "New Granular Scopes" table in "API Granular Permissions:
 * Problems/Goals". Bundles come from the "Proposed Bundles" table in "Final Plan for
 * permission scopes".
 */

export type DataAccess = 'own' | 'all';

/** The action a scope allows. Scopes are not hierarchical. */
export type ScopeAction = 'read' | 'create' | 'write' | 'delete' | 'invite';

export interface Scope {
  action: ScopeAction;
  /** Changes spend, quota or data collection. */
  costImpact: boolean;
  /** Not reversible, or hard to recreate. */
  irreversible: boolean;
  /** The full scope string, e.g. `dashboard:read`. */
  scope: string;
}

export type ScopeCategoryId = 'data' | 'ci' | 'project' | 'org' | 'people' | 'billing';

export interface ScopeCategory {
  /** Whether the step 2 project selection limits this category. */
  appliesTo: 'projects' | 'organization';
  id: ScopeCategoryId;
  label: string;
}

/** Ordered from what agents use day to day to the most sensitive. */
export const SCOPE_CATEGORIES: ScopeCategory[] = [
  {id: 'data', label: 'Data & Triage', appliesTo: 'projects'},
  {id: 'ci', label: 'Releases & CI', appliesTo: 'projects'},
  {id: 'project', label: 'Project Settings', appliesTo: 'projects'},
  {id: 'org', label: 'Organization Settings', appliesTo: 'organization'},
  {id: 'people', label: 'People & Access', appliesTo: 'organization'},
  {id: 'billing', label: 'Billing', appliesTo: 'organization'},
];

export interface ScopeResource {
  category: ScopeCategoryId;
  help: string;
  id: string;
  label: string;
  scopes: Scope[];
  /**
   * Settings have no creator, so "only its own data" can't apply to them. Guardrails
   * that limit actions to own data block these instead.
   */
  ownerless?: boolean;
}

export interface Bundle {
  /** Which existing data the bundle can modify. `null` when it cannot modify anything. */
  dataAccess: DataAccess | null;
  description: string;
  id: string;
  name: string;
  /** Granular scopes included in this bundle. */
  scopes: string[];
  /**
   * Scopes that only apply to data the service account created, on top of what
   * `dataAccess` already limits. Set by guardrails.
   */
  ownDataOnlyScopes?: string[];
}

function scopes(
  resource: string,
  actions: ScopeAction[],
  {
    costImpact = [],
    irreversible = ['delete'],
  }: {costImpact?: ScopeAction[]; irreversible?: ScopeAction[]} = {}
): Scope[] {
  return actions.map(action => ({
    scope: `${resource}:${action}`,
    action,
    irreversible: irreversible.includes(action),
    costImpact: costImpact.includes(action),
  }));
}

export const SCOPE_RESOURCES: ScopeResource[] = [
  {
    id: 'issue',
    category: 'data',
    label: 'Issues',
    help: 'Issues and their events, comments, assignees, and status changes such as resolve, archive and merge',
    scopes: scopes('issue', ['read', 'write', 'delete']),
  },
  {
    id: 'issue.discard',
    category: 'data',
    label: 'Discarded Issues',
    help: 'Delete and discard issues so their future events are dropped, and undiscard them',
    // Discarding drops future events for good. Undiscarding stores (and bills) them again.
    scopes: scopes('issue.discard', ['read', 'create', 'delete'], {
      irreversible: ['create'],
      costImpact: ['delete'],
    }),
    ownerless: true,
  },
  {
    id: 'seer.paid',
    category: 'data',
    label: 'Paid Seer Runs',
    help: "Seer runs that use your organization's Seer quota: Autofix, root cause analysis and issue scans",
    scopes: scopes('seer.paid', ['write'], {costImpact: ['write']}),
    ownerless: true,
  },
  {
    id: 'monitor',
    category: 'data',
    label: 'Monitors',
    help: 'Error, metric, uptime and cron monitors, and the alerts they send',
    scopes: scopes('monitor', ['read', 'create', 'write', 'delete']),
  },
  {
    id: 'monitor.system',
    category: 'data',
    label: 'Sentry-Created Monitors',
    help: 'Monitors Sentry creates automatically for each project, for example the issue stream monitor',
    scopes: scopes('monitor.system', ['write', 'delete']),
    ownerless: true,
  },
  {
    id: 'dashboard',
    category: 'data',
    label: 'Dashboards',
    help: 'Dashboards, their widgets, and who can edit each dashboard',
    scopes: scopes('dashboard', ['read', 'create', 'write', 'delete']),
  },
  {
    id: 'telemetry',
    category: 'data',
    label: 'Telemetry',
    help: 'Spans, logs, metrics, replays and profiles',
    scopes: scopes('telemetry', ['read', 'write']),
  },
  {
    id: 'project_v2',
    category: 'project',
    label: 'Projects',
    help: 'Create and delete projects, and edit their name, platform, default environment, auto-resolve age, alert email subject, digests and grouping rules',
    scopes: scopes('project_v2', ['read', 'create', 'write', 'delete']),
  },
  {
    id: 'project.transfer',
    category: 'project',
    label: 'Project Transfer',
    help: 'Move a project to another organization',
    scopes: scopes('project.transfer', ['write'], {irreversible: ['write']}),
    ownerless: true,
  },
  {
    id: 'project.security',
    category: 'project',
    label: 'Project Security & Privacy',
    help: 'Data scrubbing rules, sensitive and safe fields, IP address scrubbing, allowed domains, security token, SSL verification and symbol source credentials',
    scopes: scopes('project.security', ['read', 'write'], {irreversible: ['write']}),
    ownerless: true,
  },
  {
    id: 'team',
    category: 'people',
    label: 'Teams',
    help: 'Create, rename and delete teams, add and remove team members, and change which projects a team owns',
    scopes: scopes('team', ['read', 'write', 'delete']),
    ownerless: true,
  },
  {
    id: 'team.role',
    category: 'people',
    label: 'Team Roles',
    help: 'Change whether a team member is a Contributor or a Team Admin',
    scopes: scopes('team.role', ['write']),
    ownerless: true,
  },
  {
    id: 'member_v2',
    category: 'people',
    label: 'Members',
    help: 'View, invite and remove organization members',
    scopes: scopes('member_v2', ['read', 'invite', 'write', 'delete']),
    ownerless: true,
  },
  {
    id: 'member.role',
    category: 'people',
    label: 'Member Roles',
    help: 'Change the organization role of a member: Member, Admin, Manager, Owner or Billing',
    scopes: scopes('member.role', ['write']),
    ownerless: true,
  },
  {
    id: 'org.general',
    category: 'org',
    label: 'Organization',
    help: 'Organization name, avatar, Apdex threshold, alert thread settings and early adopter status, and deleting the organization',
    scopes: scopes('org.general', ['read', 'write', 'delete']),
    ownerless: true,
  },
  {
    id: 'org.security',
    category: 'org',
    label: 'Organization Security & Privacy',
    help: 'Superuser access, enhanced privacy, trusted relays, shared issues, JavaScript source fetching and organization-wide data scrubbing defaults',
    // Loosening scrubbing can leak PII and tightening collection loses data, and neither
    // can be undone, so editing is irreversible.
    scopes: scopes('org.security', ['read', 'write'], {irreversible: ['write']}),
    ownerless: true,
  },
  {
    id: 'org.spend',
    category: 'org',
    label: 'Organization Spend',
    help: 'Organization sample rate, sampling mode and crash report storage',
    scopes: scopes('org.spend', ['read', 'write'], {costImpact: ['write']}),
    ownerless: true,
  },
  {
    id: 'billing',
    category: 'billing',
    label: 'Billing',
    help: 'Plan, subscription changes, payment details, invoices and usage',
    scopes: scopes('billing', ['read', 'write'], {costImpact: ['write']}),
    ownerless: true,
  },
  {
    id: 'billing.filter',
    category: 'project',
    label: 'Project Inbound Filters',
    help: 'Filters that drop events before they are stored: browser extensions, localhost, legacy browsers, web crawlers, health checks, and custom filters by IP, release or error message. Turning one off increases usage.',
    // Creating a filter drops matching events for good, so it is irreversible. Removing
    // one is reversible but stores (and bills) more events.
    scopes: scopes('billing.filter', ['read', 'create', 'delete'], {
      irreversible: ['create'],
      costImpact: ['delete'],
    }),
    ownerless: true,
  },
  {
    id: 'integrations',
    category: 'org',
    label: 'Integrations',
    help: 'Install, configure and uninstall integrations such as GitHub, Slack and Jira, and their code mappings',
    scopes: scopes('integrations', ['read', 'write']),
  },
  {
    id: 'release',
    category: 'ci',
    label: 'Releases',
    help: 'Create, finalize and delete releases, deploys and their associated commits',
    scopes: scopes('release', ['read', 'write', 'delete']),
  },
  {
    id: 'sourcemap',
    category: 'ci',
    label: 'Source Maps',
    help: 'Upload, list and delete source maps and artifact bundles',
    scopes: scopes('sourcemap', ['read', 'write', 'delete']),
  },
  {
    id: 'repository',
    category: 'ci',
    label: 'Repositories',
    help: 'Connect and remove code repositories used for commit tracking, suspect commits and Seer',
    scopes: scopes('repository', ['read', 'write', 'delete']),
  },
];

const ALL_SCOPES = SCOPE_RESOURCES.flatMap(resource => resource.scopes);
export const ALL_SCOPE_IDS = ALL_SCOPES.map(scope => scope.scope);
const OWNERLESS_SCOPES = new Set(
  SCOPE_RESOURCES.filter(resource => resource.ownerless).flatMap(resource =>
    resource.scopes.map(scope => scope.scope)
  )
);

function scopeIds(filter: (scope: Scope) => boolean): string[] {
  return ALL_SCOPES.filter(filter).map(scope => scope.scope);
}

const SENSITIVE_RESOURCES = [
  'member_v2:',
  'team:',
  'team.role:',
  'member.role:',
  'project.transfer:',
  'org.general:',
  'org.spend:',
  'org.security:',
  'project.security:',
  'billing',
  'integrations:',
];

/**
 * Hardcoded stand-in for the creator's role. Only org admins (`org:admin`, the Owner
 * role) can create service accounts, so the POC assumes an Owner, who can do everything.
 */
export const CURRENT_USER_ROLE = 'Owner';

const OWNER_ROLE_SCOPES = ALL_SCOPE_IDS;

export const DEFAULT_BUNDLE_ID = 'default_agent';
export const CUSTOM_BUNDLE_ID = 'custom';

/** Ordered from least to most permissive. */
export const BUNDLES: Bundle[] = [
  {
    id: 'read_only',
    name: 'Read Only',
    description: 'Read access to everything, including settings. Cannot change anything.',
    dataAccess: null,
    scopes: scopeIds(scope => scope.action === 'read'),
  },
  {
    id: 'ci',
    name: 'CI',
    description:
      'Reads everything, and can manage repositories, source maps and integrations from a CI pipeline.',
    dataAccess: 'all',
    scopes: scopeIds(
      scope =>
        scope.action === 'read' ||
        ['repository:', 'sourcemap:', 'integrations:'].some(prefix =>
          scope.scope.startsWith(prefix)
        )
    ),
  },
  {
    id: 'default_agent',
    name: 'Default Agent',
    description:
      'Reads everything, and can edit or delete data created by this service account. Members, teams, organization settings and integrations stay read-only.',
    dataAccess: 'own',
    scopes: scopeIds(
      scope =>
        scope.action === 'read' ||
        // It only changes its own data, so things with no owner stay read-only too.
        (!OWNERLESS_SCOPES.has(scope.scope) &&
          !SENSITIVE_RESOURCES.some(prefix => scope.scope.startsWith(prefix)))
    ),
  },
  {
    id: 'my_permissions',
    name: 'Whatever my role can do',
    description: `The same permissions you (${CURRENT_USER_ROLE}) have at the time you create this service account, including modifying data created by other users.`,
    dataAccess: 'all',
    scopes: OWNER_ROLE_SCOPES,
  },
  {
    id: CUSTOM_BUNDLE_ID,
    name: 'Custom',
    description: 'Choose individual permissions, up to what your role allows.',
    // Guardrails decide what is limited to its own data, so Custom has no limit of its own.
    dataAccess: 'all',
    // Starting point only. The page keeps the chosen scopes in state.
    scopes: [],
  },
];

export function getGrantedScopes(bundle: Bundle, resource: ScopeResource): Scope[] {
  return resource.scopes.filter(scope => bundle.scopes.includes(scope.scope));
}

/** Edits and deletes are limited to own data. Reads and creates are not. */
export function isLimitedByDataAccess(scope: Scope): boolean {
  return (
    scope.action !== 'read' && scope.action !== 'create' && scope.action !== 'invite'
  );
}

export type GuardrailId = 'cost_impact' | 'data_irreversible';

export interface Guardrail {
  description: string;
  /**
   * `remove` takes the scopes out of the bundle. `own_data_only` keeps them, but only
   * for data the service account created.
   */
  effect: 'remove' | 'own_data_only';
  id: GuardrailId;
  name: string;
  /** Scopes this guardrail applies to. */
  scopes: string[];
}

/**
 * The doc's `cost_impact` and `data_irreversible` bundles, used as restrictions on top
 * of the selected bundle.
 */
export const GUARDRAILS: Guardrail[] = [
  {
    id: 'cost_impact',
    effect: 'remove',
    name: 'Block cost-impacting actions',
    description:
      'Blocks paid Seer runs, undiscarding issues, removing project inbound filters, and changing organization spend settings or billing.',
    scopes: scopeIds(scope => scope.costImpact),
  },
  {
    id: 'data_irreversible',
    effect: 'own_data_only',
    name: 'Only allow irreversible actions on its own data',
    description:
      'Can delete data this service account created, but not data created by others. Irreversible changes to things with no owner, such as settings, discarded issues or project transfers, are blocked.',
    scopes: scopeIds(scope => scope.irreversible),
  },
];

export function applyGuardrails(bundle: Bundle, guardrails: GuardrailId[]): Bundle {
  const active = GUARDRAILS.filter(guardrail => guardrails.includes(guardrail.id));
  const scopesFor = (effect: Guardrail['effect']) =>
    active.filter(g => g.effect === effect).flatMap(guardrail => guardrail.scopes);

  // "Own data only" means nothing for settings, which have no owner, so those scopes are
  // removed instead.
  const isOwnerless = (scope: string) => OWNERLESS_SCOPES.has(scope);
  const ownDataOnlyScopes = scopesFor('own_data_only');
  const removed = new Set([
    ...scopesFor('remove'),
    ...ownDataOnlyScopes.filter(isOwnerless),
  ]);
  const ownDataOnly = new Set(ownDataOnlyScopes.filter(scope => !isOwnerless(scope)));

  const keptScopes = bundle.scopes.filter(scope => !removed.has(scope));
  return {
    ...bundle,
    scopes: keptScopes,
    ownDataOnlyScopes: keptScopes.filter(scope => ownDataOnly.has(scope)),
  };
}

export function getCategoryResources(category: ScopeCategoryId): ScopeResource[] {
  return SCOPE_RESOURCES.filter(resource => resource.category === category);
}

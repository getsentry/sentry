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

export type ScopeCategoryId = 'data' | 'ci';

export interface ScopeCategory {
  /** Whether the step 2 project selection limits this category. */
  appliesTo: 'projects' | 'organization';
  id: ScopeCategoryId;
  label: string;
}

/**
 * Service accounts only get telemetry and CI access. Settings, people and billing are
 * left out.
 */
export const SCOPE_CATEGORIES: ScopeCategory[] = [
  {id: 'data', label: 'Data & Triage', appliesTo: 'projects'},
  {id: 'ci', label: 'Releases & CI', appliesTo: 'projects'},
];

export interface ScopeResource {
  category: ScopeCategoryId;
  help: string;
  id: string;
  label: string;
  scopes: Scope[];
  /** Settings have no creator, so "only its own data" can't apply to them. */
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

const OWNER_ROLE_SCOPES = ALL_SCOPE_IDS;

export const DEFAULT_BUNDLE_ID = 'default_agent';

/** Ordered from least to most permissive. */
export const BUNDLES: Bundle[] = [
  {
    id: 'read_only',
    name: 'Read Only',
    description:
      "Reads issues, telemetry, monitors, dashboards and releases. Can't change anything.",
    dataAccess: null,
    scopes: scopeIds(scope => scope.action === 'read'),
  },
  {
    id: 'ci',
    name: 'CI',
    description:
      'Reads everything, and can manage repositories and source maps from a CI pipeline.',
    dataAccess: 'all',
    scopes: scopeIds(
      scope =>
        scope.action === 'read' ||
        ['repository:', 'sourcemap:'].some(prefix => scope.scope.startsWith(prefix))
    ),
  },
  {
    id: 'default_agent',
    name: 'Default Agent',
    description: 'Reads everything, and can edit or delete data this account created.',
    dataAccess: 'own',
    scopes: scopeIds(
      scope =>
        scope.action === 'read' ||
        // It only changes its own data, so things with no owner stay read-only.
        !OWNERLESS_SCOPES.has(scope.scope)
    ),
  },
  {
    id: 'my_permissions',
    name: 'Whatever my role can do',
    description: 'The same permissions you have when you create the account.',
    dataAccess: 'all',
    scopes: OWNER_ROLE_SCOPES,
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

export function getCategoryResources(category: ScopeCategoryId): ScopeResource[] {
  return SCOPE_RESOURCES.filter(resource => resource.category === category);
}

export function getBundle(id: string): Bundle {
  return BUNDLES.find(bundle => bundle.id === id) ?? BUNDLES[0]!;
}

export function getScopeResource(scope: string): ScopeResource | undefined {
  return SCOPE_RESOURCES.find(resource =>
    resource.scopes.some(resourceScope => resourceScope.scope === scope)
  );
}

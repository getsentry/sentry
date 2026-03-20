#!/usr/bin/env bash
# routes.sh - Parse Sentry routes and build navigable URLs by substituting params.
#
# Usage:
#   ./scripts/routes.sh --orgId sentry
#   ./scripts/routes.sh --orgId sentry --projectId my-project
#   ./scripts/routes.sh --orgId sentry --defaults
#   ./scripts/routes.sh --origin https://sentry.io --orgId sentry
#   ./scripts/routes.sh --all
#
# ─── AGENT MAINTENANCE GUIDE ─────────────────────────────────────────────────
#
# HOW THE PARSER WORKS
#   The Node.js section reads static/app/router/routes.tsx line by line and
#   builds full paths using an indentation-based stack: when a `path:` line
#   at indent N is encountered, all stack entries with indent >= N are popped,
#   then the new path is joined onto the remaining top of stack.
#
#   This works correctly for inline-defined routes (the majority).  It breaks
#   for route variables that are DEFINED in one place and ASSEMBLED in another,
#   because the definition-site indentation doesn't reflect the assembly-site
#   parent path.  These are called "fragments".
#
# HOW TO DIAGNOSE NEW FRAGMENTS
#   Run:  ./scripts/routes.sh --all 2>/dev/null | grep '^\[fragment\]'
#
#   A new fragment means a route variable was refactored to be defined
#   separately from its assembly point.  To identify its correct parent:
#   1. Find the fragment path in routes.tsx (e.g. grep for the first segment).
#   2. Find the const array or object it belongs to (e.g. fooChildren).
#   3. Find where that variable appears in a `children:` property.
#   4. Walk up the children chain to find the absolute parent path.
#   The correct prefix is: (absolute parent path) + (variable's own path, if any).
#
# THE FRAGMENT REMAP TABLE  (see `remapFragment` function in Node.js section)
#   Each entry maps a fragment path pattern to its correct absolute prefix.
#   Current mappings and their cause:
#
#   FRAGMENT PATTERN              CAUSE                         CORRECT PREFIX
#   :orgId/                       experimentalSpaChildRoutes    /auth/login/
#                                 defined before /auth/login/
#   details/ notifications/ …     accountSettingsChildren       /settings/account/
#                                 defined before accountSettingsRoutes
#   account/ (root only)          accountSettingsRoutes.path    /settings/account/
#                                 defined before settingsRoutes
#   account/*                     projectSettingsChildren       /settings/:orgId/projects/:projectId/
#                                 picks up accountSettingsRoutes as parent
#   projects/:projectId/ (root)   projectSettingsRoutes.path    /settings/:orgId/projects/:projectId/
#   projects/:projectId/*         orgSettingsChildren           /settings/:orgId/
#                                 picks up projectSettingsRoutes as parent
#   summary/ (root only)          transactionSummaryRoute.path  /performance/summary/
#   summary/(replays|tags|…)      transaction summary tabs      /performance/summary/
#   summary/*                     domainViewChildRoutes         /insights/
#                                 picks up summary/ as parent
#   trace/:traceSlug/ (root)      traceView.path                /performance/
#   trace/:traceSlug/*            alertChildRoutes function     /alerts/
#                                 body picks up traceView as parent
#
#   To add a new remapping: add a branch to `remapFragment` in the Node.js
#   section.  Order matters — more specific patterns must come before broader
#   ones (e.g. check `account/` before `account/*`).
#
# TEMPLATE LITERAL CONSTANTS  (see `CONSTANTS` object in Node.js section)
#   Template literal paths like `path: \`/${DOMAIN_VIEW_BASE_URL}/\`` are
#   resolved by substituting known constant values from the CONSTANTS map.
#   If a new template literal path appears with an unresolved <varName> token
#   in the output, find the constant's value in its source file (check the
#   import at the top of routes.tsx) and add it to CONSTANTS.
#
# DEFAULT PARAMS  (see `PARAM_DEFAULTS` in Node.js section)
#   Used when --defaults is passed.  If a new :param appears in routes.tsx
#   that isn't in PARAM_DEFAULTS, it will remain unresolved.  Add it with any
#   realistic value (fixture IDs, slugs, etc. from tests/js/fixtures/).
#
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROUTES_FILE="${SCRIPT_DIR}/../static/app/router/routes.tsx"
ORIGIN="http://dev.getsentry.net:7999"
SHOW_ALL=false
USE_DEFAULTS=false

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS] --<param> <value> [...]

Parse Sentry routes and build navigable URLs.

Options:
  --origin <url>    Base URL (default: http://dev.getsentry.net:7999)
  --all             Show all routes without param filtering
  --defaults        Fill unresolved :params with fixture defaults
  --agent           Print maintenance instructions for AI agents
  --help            Show this help

Examples:
  $(basename "$0") --orgId sentry
  $(basename "$0") --orgId sentry --defaults
  $(basename "$0") --orgId sentry --projectId project-slug
  $(basename "$0") --origin https://sentry.io --orgId sentry --defaults
  $(basename "$0") --all --defaults
EOF
  exit 0
}

params_json="{"
params_count=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --origin)   ORIGIN="$2"; shift 2 ;;
    --all)      SHOW_ALL=true; shift ;;
    --defaults) USE_DEFAULTS=true; shift ;;
    --agent)    sed -n '/^# ─── AGENT MAINTENANCE GUIDE/,/^# ─────/p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    --help|-h)  usage ;;
    --*)
      key="${1#--}"
      [[ $# -lt 2 ]] && { echo "Error: $1 requires a value" >&2; exit 1; }
      [[ "$params_count" -gt 0 ]] && params_json+=","
      params_json+="\"${key}\":\"$2\""
      params_count=$((params_count + 1))
      shift 2
      ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done
params_json+="}"

if [[ "$SHOW_ALL" == false && "$params_count" -eq 0 && "$USE_DEFAULTS" == false ]]; then
  usage
fi

ORIGIN="$ORIGIN" \
PARAMS="$params_json" \
SHOW_ALL="$SHOW_ALL" \
USE_DEFAULTS="$USE_DEFAULTS" \
ROUTES_FILE="$ROUTES_FILE" \
node - << 'NODEJS'
const fs = require('fs');

const origin      = process.env.ORIGIN;
const params      = JSON.parse(process.env.PARAMS);
const showAll     = process.env.SHOW_ALL === 'true';
const useDefaults = process.env.USE_DEFAULTS === 'true';
const routesFile  = process.env.ROUTES_FILE;

// ─── Known constants from routes.tsx imports ────────────────────────────────
// Values sourced from the imported modules at the top of routes.tsx.
// Update here if upstream constants change.
const CONSTANTS = {
  // sentry/views/insights/pages/settings
  'DOMAIN_VIEW_BASE_URL': 'insights',
  // sentry/views/insights/settings
  'INSIGHTS_BASE_URL': 'insights',
  // sentry/views/insights/pages/frontend/settings
  'FRONTEND_LANDING_SUB_PATH': 'frontend',
  // sentry/views/insights/pages/backend/settings
  'BACKEND_LANDING_SUB_PATH': 'backend',
  // sentry/views/insights/pages/mobile/settings
  'MOBILE_LANDING_SUB_PATH': 'mobile',
  // sentry/views/insights/pages/mcp/settings
  'MCP_LANDING_SUB_PATH': 'mcp',
  // sentry/views/insights/pages/conversations/settings
  'CONVERSATIONS_LANDING_SUB_PATH': 'conversations',
  // sentry/views/insights/pages/agents/settings
  'AGENTS_LANDING_SUB_PATH': 'ai-agents',
  // sentry/views/insights/common/utils/useModuleURL → MODULE_BASE_URLS
  'MODULE_BASE_URLS[ModuleName.HTTP]':             'http',
  'MODULE_BASE_URLS[ModuleName.VITAL]':            'pageloads',
  'MODULE_BASE_URLS[ModuleName.RESOURCE]':         'assets',
  'MODULE_BASE_URLS[ModuleName.DB]':               'database',
  'MODULE_BASE_URLS[ModuleName.CACHE]':            'caches',
  'MODULE_BASE_URLS[ModuleName.QUEUE]':            'queues',
  'MODULE_BASE_URLS[ModuleName.MOBILE_VITALS]':    'mobile-vitals',
  'MODULE_BASE_URLS[ModuleName.SESSIONS]':         'sessions',
  'MODULE_BASE_URLS[ModuleName.MCP_TOOLS]':        'tools',
  'MODULE_BASE_URLS[ModuleName.MCP_RESOURCES]':    'resources',
  'MODULE_BASE_URLS[ModuleName.MCP_PROMPTS]':      'prompts',
  'MODULE_BASE_URLS[ModuleName.AGENT_MODELS]':     'models',
  'MODULE_BASE_URLS[ModuleName.AGENT_TOOLS]':      'tools',
  'MODULE_BASE_URLS[ModuleName.SCREEN_LOAD]':      'screens',
  'MODULE_BASE_URLS[ModuleName.APP_START]':        'app-startup',
  'MODULE_BASE_URLS[ModuleName.SCREEN_RENDERING]': 'screen-rendering',
  'MODULE_BASE_URLS[ModuleName.MOBILE_UI]':        'ui',
  // sentry/views/issueDetails/types → TabPaths
  'TabPaths[Tab.DETAILS]':        '',
  'TabPaths[Tab.ACTIVITY]':       'activity/',
  'TabPaths[Tab.USER_FEEDBACK]':  'feedback/',
  'TabPaths[Tab.ATTACHMENTS]':    'attachments/',
  'TabPaths[Tab.DISTRIBUTIONS]':  'distributions/',
  'TabPaths[Tab.EVENTS]':         'events/',
  'TabPaths[Tab.MERGED]':         'merged/',
  'TabPaths[Tab.SIMILAR_ISSUES]': 'similar/',
  'TabPaths[Tab.REPLAYS]':        'replays/',
  'TabPaths[Tab.OPEN_PERIODS]':   'open-periods/',
  'TabPaths[Tab.CHECK_INS]':      'check-ins/',
  'TabPaths[Tab.UPTIME_CHECKS]':  'uptime-checks/',
  // sentry/views/issueList/taxonomies → IssueTaxonomy
  'IssueTaxonomy.ERRORS_AND_OUTAGES': 'errors-outages',
  'IssueTaxonomy.BREACHED_METRICS':   'breached-metrics',
  'IssueTaxonomy.WARNINGS':           'warnings',
};

function resolveTemplate(expr) {
  return expr.replace(/\$\{([^}]+)\}/g, (_, inner) => {
    const key = inner.trim();
    if (CONSTANTS[key] !== undefined) return CONSTANTS[key];
    const hint = key.split(/[\.\[\(\s]/)[0].trim();
    return `<${hint}>`;
  });
}

// ─── Fragment remapping ──────────────────────────────────────────────────────
// The indentation-based parser assigns wrong parent paths to route groups that
// are defined in separate variables and assembled elsewhere.  These rules
// correct the known cases by inspecting the routes file structure.
//
// Groups and why they're wrong:
//   accountSettingsChildren  — defined before accountSettingsRoutes; picks up
//     no parent → fragments like details/, notifications/, api/, security/...
//     Correct prefix: /settings/account/
//
//   projectSettingsChildren  — defined before projectSettingsRoutes; picks up
//     accountSettingsRoutes (path:'account/') as parent → account/install/, …
//     Correct prefix: /settings/:orgId/projects/:projectId/
//
//   orgSettingsChildren      — defined before orgSettingsRoutes; picks up
//     projectSettingsRoutes (path:'projects/:projectId/') as parent
//     → projects/:projectId/organization/, projects/:projectId/members/, …
//     Correct prefix: /settings/:orgId/
//
//   transactionSummaryRoute  — defined before performanceRoutes; picks up
//     no parent → summary/, summary/replays/, summary/tags/, …
//     Its own path 'summary/' should be under /performance/.
//     The domainViewChildRoutes entries (http/, database/, …) also pick up
//     'summary/' as parent → summary/http/, summary/database/, …
//     Correct prefix: /performance/summary/ for tabs, /insights/ for modules.
//
//   alertChildRoutes function body — defined before alertRoutes assembly;
//     entries at depth 6 pick up traceView (path:'trace/:traceSlug/') as
//     parent → trace/:traceSlug/rules/, trace/:traceSlug/new/, …
//     Correct prefix: /alerts/

// Transaction summary tab routes (direct children of transactionSummaryRoute)
const SUMMARY_TABS = new Set(['replays/', 'tags/', 'events/', 'profiles/']);

// accountSettingsChildren root segment set (used to detect bare fragments)
const ACCOUNT_SETTINGS_ROOTS = [
  'details/', 'notifications/', 'emails/', 'merge-accounts/', 'authorizations/',
  'security/', 'subscriptions/', 'identities/', 'api/', 'close-account/',
];

function remapFragment(path) {
  // :orgId/ is from experimentalSpaChildRoutes under /auth/login/
  if (path === ':orgId/') return '/auth/login/:orgId/';

  // accountSettingsChildren: bare paths like details/, security/mfa/:authId/, …
  if (ACCOUNT_SETTINGS_ROOTS.some(r => path === r || path.startsWith(r))) {
    return `/settings/account/${path}`;
  }

  // accountSettingsRoutes root (the variable's own path: 'account/')
  if (path === 'account/') return '/settings/account/';

  // projectSettingsChildren: incorrectly parented under account/
  if (path.startsWith('account/')) {
    return `/settings/:orgId/projects/:projectId/${path.slice('account/'.length)}`;
  }

  // projectSettingsRoutes root (path: 'projects/:projectId/')
  if (path === 'projects/:projectId/') return '/settings/:orgId/projects/:projectId/';

  // orgSettingsChildren: incorrectly parented under projects/:projectId/
  if (path.startsWith('projects/:projectId/')) {
    return `/settings/:orgId/${path.slice('projects/:projectId/'.length)}`;
  }

  // transactionSummaryRoute root
  if (path === 'summary/') return '/performance/summary/';

  // Transaction summary tab children
  if (path.startsWith('summary/')) {
    const suffix = path.slice('summary/'.length);
    const topSegment = suffix.split('/')[0] + '/';
    if (SUMMARY_TABS.has(topSegment)) return `/performance/summary/${suffix}`;
    // Everything else under summary/ is a domainViewChildRoute
    return `/insights/${suffix}`;
  }

  // traceView root — assembled into /performance/ (and /dashboards/, /traces/)
  if (path === 'trace/:traceSlug/') return '/performance/trace/:traceSlug/';

  // alertChildRoutes entries: incorrectly parented under trace/:traceSlug/
  if (path.startsWith('trace/:traceSlug/')) {
    return `/alerts/${path.slice('trace/:traceSlug/'.length)}`;
  }

  return null; // no remapping needed
}

// ─── Default param values ────────────────────────────────────────────────────
// Fixture-derived defaults for every :param seen in the route tree.
// Applied when --defaults is set, after any user-supplied values.
// Sources: tests/js/fixtures/ and Sentry URL conventions.
const PARAM_DEFAULTS = {
  projectId:        'project-slug',
  teamId:           'team-slug',
  groupId:          '1234567',
  eventId:          'latest',
  shareId:          'share-id-abc',
  traceSlug:        'abc123def456abc1',
  dashboardId:      '1',
  templateId:       'default',
  release:          '1.0.0',
  replaySlug:       'replay-slug',
  monitorSlug:      'my-monitor',
  alertId:          '1',
  ruleId:           '1',
  detectorId:       '1',
  memberId:         '1',
  token:            'abc123token',
  tagKey:           'environment',
  apiKey:           'abc123api',
  tokenId:          '1',
  pluginId:         'my-plugin',
  integrationSlug:  'github',
  integrationId:    '1',
  providerKey:      'github',
  appSlug:          'my-sentry-app',
  appId:            '1',
  keyId:            '1',
  hookId:           '1',
  authId:           '1',
  bundleId:         '1',
  artifactId:       '1',
  searchId:         '1',
  viewId:           '1',
  dataForwarderId:  '1',
  filterType:       'browser-extensions',
  scrubbingId:      '1',
  fineTuneType:     'alerts',
  alertType:        'issues',
  widgetIndex:      '0',
  widgetId:         '1',
  dataExportId:     '1',
  sentryAppSlug:    'my-sentry-app',
  installationId:   'abc123install',
  platform:         'python',
  step:             'welcome',
  id:               '1',
  splat:            'index',
  snapshotId:       '1',
  headArtifactId:   '1',
  baseArtifactId:   '2',
};

// ─── Parse routes file ───────────────────────────────────────────────────────
const content = fs.readFileSync(routesFile, 'utf8');
const lines   = content.split('\n');

// Indentation-based path stack.
// When we encounter path: at indent N, pop all stack entries with indent >= N
// (they are siblings / completed children), then join with the top of stack.
const stack   = [];
const rawPaths = [];
const seen    = new Set();

for (const line of lines) {
  const indent = line.search(/\S/);
  if (indent === -1) continue;

  let pathValue  = null;
  let hasUnknown = false;

  const singleMatch   = line.match(/\bpath:\s*'([^']+)'/);
  const doubleMatch   = line.match(/\bpath:\s*"([^"]+)"/);
  const templateMatch = line.match(/\bpath:\s*`([^`]+)`/);

  if (singleMatch) {
    pathValue = singleMatch[1];
  } else if (doubleMatch) {
    pathValue = doubleMatch[1];
  } else if (templateMatch) {
    pathValue  = resolveTemplate(templateMatch[1]);
    hasUnknown = pathValue.includes('<');
  }

  if (pathValue === null) continue;

  while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
    stack.pop();
  }

  const parent = stack.length > 0 ? stack[stack.length - 1].fullPath : '';
  let fullPath;
  if (pathValue.startsWith('/')) {
    fullPath = pathValue;
  } else if (parent === '') {
    fullPath = pathValue; // will be a fragment until remapping
  } else {
    fullPath = parent.replace(/\/?$/, '/') + pathValue;
  }

  stack.push({ indent, fullPath, hasUnknown });

  if (!seen.has(fullPath)) {
    seen.add(fullPath);
    rawPaths.push({ fullPath, hasUnknown });
  }
}

// ─── Apply fragment remapping ────────────────────────────────────────────────
const allPaths = rawPaths.map(({ fullPath, hasUnknown }) => {
  if (!fullPath.startsWith('/')) {
    const remapped = remapFragment(fullPath);
    if (remapped) return { fullPath: remapped, hasUnknown, wasFragment: true };
    return { fullPath, hasUnknown, wasFragment: true };
  }
  return { fullPath, hasUnknown, wasFragment: false };
});

// Deduplicate after remapping (some remapped paths may collide with absolutes)
const deduped = [];
const seenFinal = new Set();
for (const entry of allPaths) {
  if (!seenFinal.has(entry.fullPath)) {
    seenFinal.add(entry.fullPath);
    deduped.push(entry);
  }
}

// ─── Build effective params (user-supplied + defaults) ───────────────────────
const effectiveParams = useDefaults
  ? { ...PARAM_DEFAULTS, ...params }
  : { ...params };

// ─── Filter & resolve ────────────────────────────────────────────────────────
const matching = [];
for (const { fullPath, hasUnknown } of deduped) {
  const required = (fullPath.match(/:[a-zA-Z][a-zA-Z0-9]*/g) || [])
    .map(p => p.slice(1));

  if (!showAll) {
    const providedInRoute = required.filter(p => effectiveParams[p] !== undefined);
    if (required.length > 0 && providedInRoute.length === 0) continue;
  }

  let resolved = fullPath;
  for (const [k, v] of Object.entries(effectiveParams)) {
    resolved = resolved.replace(new RegExp(':' + k + '(?=[^a-zA-Z0-9]|$)', 'g'), v);
  }

  matching.push({ url: resolved, hasUnknown, isAbsolute: resolved.startsWith('/') });
}

// ─── Output ──────────────────────────────────────────────────────────────────
const paramStr     = Object.entries(params).map(([k, v]) => `${k}=${v}`).join(', ');
const absCount     = matching.filter(r => r.isAbsolute).length;
const fragCount    = matching.length - absCount;
const resolvedPct  = matching.length > 0
  ? Math.round(absCount * 100 / matching.length)
  : 0;
const fullyNavPct  = matching.length > 0
  ? Math.round(matching.filter(r => r.isAbsolute && !r.url.includes(':') && !r.url.includes('*') && !r.url.includes('<')).length * 100 / matching.length)
  : 0;

for (const { url, hasUnknown, isAbsolute } of matching) {
  const prefix = isAbsolute ? origin : '[fragment]';
  const suffix = hasUnknown ? '  # unresolved template' : '';
  console.log(`${prefix}${url}${suffix}`);
}

console.log('─'.repeat(72));
const paramDisplay = [
  paramStr && `params: ${paramStr}`,
  useDefaults && 'defaults: on',
].filter(Boolean).join('  ');
console.log(`Matched: ${matching.length} / ${deduped.length} routes${paramDisplay ? `  (${paramDisplay})` : ''}`);
console.log(`         ${absCount} absolute (${resolvedPct}%), ${fragCount} still-fragments`);
console.log(`Origin:  ${origin}`);
NODEJS

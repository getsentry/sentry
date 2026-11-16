// Sentry's decision-model lint rules: https://github.com/getsentry/decision-model-linter
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

import type {Config, Model, Suite} from '@sentry/decision-model-linter';

const jev = {
  provider: 'openrouter',
  name: 'typesafe/jev-1.13',
  apiKey: process.env.OPENROUTER_API_KEY,
  maxInputTokens: 32_768,
} satisfies Model;

const diffBase = process.env.DECISION_MODEL_LINT_BASE;
const NO_DIFF = 'No diff available.';
const execFileAsync = promisify(execFile);

// the PR's renames (new path -> old path) which is loaded once per run and shared by every file
let renames: Promise<Map<string, string>> | undefined;

function renamedFrom(base: string): Promise<Map<string, string>> {
  if (renames !== undefined) {
    return renames;
  }

  renames = execFileAsync('git', ['diff', '--name-status', '--find-renames', base])
    .then(({stdout}) => {
      const map = new Map<string, string>();
      let line: string;
      for (line of stdout.split('\n')) {
        const [status, oldPath, newPath] = line.split('\t');
        if (status?.startsWith('R') && oldPath && newPath) {
          map.set(newPath, oldPath);
        }
      }
      return map;
    })
    .catch(() => new Map<string, string>());
  return renames;
}

// the engine shows a changed file's new lines only, so a rule can't tell new code from code
// that was already there. The diff adds the removed lines, with no context lines so unchanged
// code stays hidden from the other rules in the suite
async function diff({path}: {path: string}): Promise<string> {
  if (!diffBase) {
    return NO_DIFF;
  }
  try {
    const oldPath = (await renamedFrom(diffBase)).get(path);
    let paths: string[];
    if (oldPath) {
      paths = [oldPath, path];
    } else {
      paths = [path];
    }

    const gitArgs = ['diff', '--unified=0', '--find-renames', diffBase, '--'].concat(
      paths
    );
    const result = await execFileAsync('git', gitArgs);
    const stdout = result.stdout;

    // a new file has no earlier version to compare and its diff would repeat the whole file
    if (!stdout || /^new file mode/m.test(stdout)) {
      return NO_DIFF;
    }
    return stdout;
  } catch {
    return NO_DIFF;
  }
}

// added to the prompts of rules that should only report problems the change itself adds
const CAUSED_BY_THIS_CHANGE =
  'Use diff to tell whether this change caused it: compare its - (removed) and + (added) lines. A line that only moved or was reformatted appears as both - and +, so it already existed. If diff says No diff available., treat the whole file as under review and answer INTRODUCED for any problem.';

const api = {
  context: {diff},
  rules: {
    addsNewOmittedFields: {
      prompt:
        'Does the code withhold a field from the public API schema by adding it to omit_from_public_schema in @sentry_schema_serializer(...)?',
      values: [
        {
          value: 'TRUE',
          description:
            'A field name and its reason are added to an omit_from_public_schema dict, so the field stays in the API but leaves the public schema and every generated SDK.',
          severity: 'warn',
          report:
            'This withholds a field from the public API schema and every generated SDK, though clients can still use it. Withhold a field only if it must never be public, and make its reason say why. To fix a missing description, add help_text to the field instead.',
        },
        {value: 'FALSE', description: 'No field is added to omit_from_public_schema.'},
      ],
    },
    readsRequestBodyOutsideSerializer: {
      // Webhook and third-party callback handlers parse external payloads, not our API params.
      // readsWebhookPayloadOutsideSerializer covers them instead.
      ignores: [
        '**/tests/**',
        '**/testutils/**',
        '**/webhooks/**',
        '**/webhook.py',
        '**/webhooks.py',
        '**/*_webhook.py',
        'src/sentry/integrations/slack/requests/**',
        'src/sentry/integrations/*/installed.py',
        'src/sentry/middleware/integrations/parsers/**',
        'src/sentry/flags/endpoints/hooks.py',
      ],
      prompt:
        'Does endpoint code read a value from the request body by key, with request.data[...], request.data.get(...), or request.POST, instead of from a serializer\'s validated_data? Checking whether a key is present (for example "confirm" in request.data) without using its value does not count.',
      values: [
        {
          value: 'TRUE',
          description:
            'Code outside a serializer looks up a key in request.data or request.POST and uses the value, whether or not a serializer also validates the body.',
          severity: 'warn',
          report:
            "Request body values should be read from a serializer's `validated_data`. This file reads a value directly from `request.data` or `request.POST`.",
        },
        {
          value: 'FALSE',
          description:
            'The body is only passed whole to a serializer, as in Serializer(data=request.data), and values are read from validated_data. Reading self.initial_data or attrs inside a serializer does not count.',
        },
      ],
    },
    readsWebhookPayloadOutsideSerializer: {
      files: [
        'src/sentry/**/webhooks/**/*.py',
        'src/sentry/**/webhook.py',
        'src/sentry/**/webhooks.py',
        'src/sentry/**/*_webhook.py',
        'src/sentry/integrations/slack/requests/**/*.py',
        'src/sentry/integrations/*/installed.py',
        'src/sentry/middleware/integrations/parsers/**/*.py',
        'src/sentry/flags/endpoints/hooks.py',
      ],
      prompt:
        "Does webhook or third-party callback code read a field from the incoming payload by key, with request.data[...], request.data.get(...), request.POST, json.loads(request.body)[...], or an integration's parsed request data such as slack_request.data[...], instead of validating the payload with a serializer or typed schema and reading from the validated result? Only key lookups made in this file count. Decoding the body and passing the whole payload to a helper does not count, even if the helper reads fields, for example data = orjson.loads(self.request.body) followed by get_vsts_external_id(data=data).",
      values: [
        {
          value: 'TRUE',
          description:
            'The code looks up keys in the raw or parsed incoming payload and uses the values directly, without a serializer or schema validating that payload first.',
          severity: 'warn',
          report:
            'Third-party webhook payloads should be validated with a serializer or typed schema before their fields are read. This file reads fields directly from the incoming payload.',
        },
        {
          value: 'FALSE',
          description:
            'The payload is validated by a serializer or schema first and values are read from the validated result, or the code only verifies a signature, reads headers, or passes the whole body to a parser without reading fields itself. Passing the whole decoded payload to a helper function without reading its keys here also does not count.',
        },
      ],
    },
    // The four rules below are a temporary, "warn only" safety net for API design rules while
    // deterministic checks for them are built. We will remove each one once its check is enforced
    returnsUnpaginatedList: {
      threshold: 0.8,
      prompt:
        'Does an endpoint\'s GET method return a list of objects that can keep growing, such as an organization\'s projects, members, issues, releases, or monitors, without paginating it with self.paginate(...) or a paginator class? A list inside a response object (for example {"data": [...]}) counts too. Lists with a small fixed limit, lists of fixed choices or enum values, single objects, and lists that are only built for internal use and never returned do not count. ' +
        CAUSED_BY_THIS_CHANGE,
      values: [
        {
          value: 'INTRODUCED',
          description:
            'This change adds a GET handler, or a newly returned list, whose growing collection nothing paginates or limits, or it removes pagination from a list that had it. When diff says No diff available., this is the answer for any such problem.',
          severity: 'warn',
          report:
            "List endpoints should paginate with `self.paginate(...)` and a `cursor` parameter. This change returns a list that can keep growing without paginating it. If the endpoint already existed, don't add pagination to it: that changes what existing callers get back.",
        },
        {
          value: 'PREEXISTING',
          description:
            'The endpoint already returned the unpaginated list before this change: its handler and return lines are not added in diff, and the change only touches nearby code. Never the answer when diff says No diff available.',
        },
        {
          value: 'NONE',
          description:
            'Every growing list the endpoint returns is paginated, or it returns a single object, a fixed set of values, or a list with a small fixed limit.',
        },
      ],
    },
    replacesMembershipWithList: {
      threshold: 0.8,
      prompt:
        'Does a PUT, PATCH, or POST that updates an existing object accept a list of IDs, users, emails, teams, or members (for example a serializers.ListField of user IDs) and use it to replace the whole stored set, by comparing it to the current members and adding or removing the difference, clearing and re-adding, or calling set()? replayAccessMembers in organization_details.py is an example: two people editing the list at the same time overwrite each other. Lists sent once when an object is first created, lists that only add members, and lists of settings or values that are not memberships do not count. ' +
        CAUSED_BY_THIS_CHANGE,
      values: [
        {
          value: 'INTRODUCED',
          description:
            'This change adds a request list field, or new code that uses one, to replace the whole stored set of members on an existing object, and diff shows no removed line for that field or logic. When diff says No diff available., this is the answer for any such problem.',
          severity: 'warn',
          report:
            "A list field that replaces a whole set of members lets two concurrent edits overwrite each other. Prefer separate endpoints to add and remove one member. Don't change or remove an existing field to fix this, because that breaks its callers.",
        },
        {
          value: 'PREEXISTING',
          description:
            'A list already replaced the stored set before this change: the field and the replacing code are not added in diff, or appear as both removed and added lines. Never the answer when diff says No diff available.',
        },
        {
          value: 'NONE',
          description:
            'No request list replaces a stored set of members, or the list is only used when creating a new object, only adds members, or is not a membership list.',
        },
      ],
    },
    returnsNumericIdAsInteger: {
      prompt:
        "Does API response code, such as a serializer's serialize() method, a response TypedDict, or the body passed to Response(...), return a numeric ID (id, or a field ending in Id or _id, such as projectId or organization_id) as an integer instead of a string? IDs converted with str(), IDs that are already strings (UUIDs, slugs, hex event IDs), counts and other numbers that are not IDs, and code that does not build an API response do not count. " +
        CAUSED_BY_THIS_CHANGE,
      values: [
        {
          value: 'INTRODUCED',
          description:
            'An added line returns a numeric ID as an integer, for example "id": obj.id, or declares an ID field as int in a response TypedDict, and no removed line in diff had that field: a new field, serializer, or endpoint. When diff says No diff available., this is the answer for any such problem.',
          severity: 'warn',
          report:
            "API responses should return numeric IDs as strings, for example `str(obj.id)`. This change adds one returned as an integer. If the field already existed, don't change its type, because callers expect a number.",
        },
        {
          value: 'PREEXISTING',
          description:
            'An ID is returned as an integer, but it already was before this change: the field also appears in a removed line in diff, or the change only touches nearby code. Never the answer when diff says No diff available.',
        },
        {
          value: 'NONE',
          description:
            'Every ID in the response is a string, or the code builds no API response.',
        },
      ],
    },
    makesExistingInputStricter: {
      threshold: 0.8,
      prompt:
        'Does the change make an endpoint or serializer that already existed reject input it used to accept, or change what callers get when they leave a field out? Compare the - (removed) and + (added) lines in diff for the same field or method. That includes: a field that becomes required (required=False or a default removed, or required=True added); a new required field added to an existing serializer; new or tighter validation on an existing field (a validate_<field> method, validators=, a smaller max_length or max_value, a larger min_length or min_value, a narrower choices list, or a new ValidationError raised from validate); an allowed value or format removed; or the default of an existing optional field changed. A serializer or endpoint is new, and does not count, when its class or def line is an added line in diff. New optional fields, relaxed validation, and lines that only moved or were reformatted do not count. If diff says No diff available., nothing existed to compare against, so answer FALSE.',
      values: [
        {
          value: 'TRUE',
          description:
            "Diff shows existing input becoming stricter or changing meaning: a field became required, a required field was added to an existing serializer, validation was added or tightened, an allowed value was removed, or an optional field's default changed.",
          severity: 'warn',
          report:
            "Rejecting input an endpoint accepted before, or changing a field's default, breaks existing callers, and the API spec often doesn't show it. Make the change backward compatible (keep the field optional, accept the old values, or keep the old default), or treat it as a breaking change and coordinate it.",
        },
        {
          value: 'FALSE',
          description:
            'The change adds a new endpoint, serializer, or optional field, relaxes or keeps existing validation and defaults, only moves or reformats lines, or diff is not available.',
        },
      ],
    },
  },
} satisfies Suite;

const audit = {
  // Models, services, operator commands, and system tasks change auth state as plumbing; the
  // audit belongs at the user-facing caller.
  ignores: [
    '**/tests/**',
    '**/testutils/**',
    '**/models/**',
    '**/deletions/**',
    '**/services/**',
    'src/sentry/management/**',
    'src/sentry/runner/**',
    'src/sentry/tasks/auth/**',
    'src/sentry/tasks/commits.py',
  ],
  rules: {
    issuesOrRevokesTokenWithoutRecord: {
      prompt:
        'Outside the OAuth flows for third-party apps (ApiGrant, ApiAuthorization, the authorize, consent, token, and authorizations endpoints, revoking a user\'s ApiAuthorization for an app, and Sentry App token exchange or refresh), does the code create, revoke, deactivate, or change the scopes of an ApiToken, OrgAuthToken, ApiKey, SentryAppInstallationToken, or an agent token grant? Authenticating a request with a token does not count. Helper classes and functions that create tokens for other code to call (for example SentryAppInstallationTokenCreator, or a service function) do not count, because the record belongs at the request handler or task that calls them. If so, does the same file record it with create_audit_entry, create_audit_entry_from_user, create_system_audit_entry, log_service.record_audit_log, capture_security_activity, or a sentry.audit logger (logging.getLogger("sentry.audit..."))?',
      values: [
        {
          value: 'TRUE',
          description:
            'The code calls create, delete, or update on one of those token models (for example ApiToken.objects.create, token.delete(), update(date_deactivated=...), or update(scope_list=...)), or calls a function whose name says it grants token scopes (for example create_write_grant). Nothing in the file records it.',
          severity: 'warn',
          report:
            'Token changes should be logged with `create_audit_entry` for org tokens or `capture_security_activity` for personal tokens. This file creates, revokes, or rescopes a token, but neither call was found in it. Ignore this if a function the file calls already logs the change.',
        },
        {
          value: 'FALSE',
          description:
            'No such token is created, revoked, or rescoped. Authenticating with a token, updating last_used or date_last_used, and the OAuth authorize, consent, and token flows for third-party apps do not count. Or the file records it.',
        },
      ],
    },
    changesPrivilegeWithoutRecord: {
      prompt:
        'Does the code grant or remove is_superuser, is_staff, or a UserPermission for a user? Organization and team roles are not privileges here. If so, does the same file record it with create_audit_entry, create_audit_entry_from_user, create_system_audit_entry, log_service.record_audit_log, capture_security_activity, or a sentry.audit logger (logging.getLogger("sentry.audit..."))?',
      values: [
        {
          value: 'TRUE',
          description:
            'The code sets is_superuser or is_staff on a User, or creates or deletes a UserPermission, and no audit_logger.info(...) call on a sentry.audit logger follows it. Judge each separately: if is_superuser or is_staff changes and only the UserPermission change is recorded, answer TRUE. Nothing in the file records it.',
          severity: 'warn',
          report:
            'Superuser, staff, and `UserPermission` changes should be logged to the `sentry.audit.user` logger. This file grants or removes one of them, but no such log call was found in it. Ignore this if a function the file calls already logs the change.',
        },
        {
          value: 'FALSE',
          description:
            'No privilege flag or UserPermission changes. Starting or ending a superuser or staff session, and checking whether a user has a privilege, do not count. Or the file records it.',
        },
      ],
    },
    changesAccountIdentityWithoutRecord: {
      prompt:
        'Does the code change a user\'s email or primary email, unlink or delete an AuthIdentity, or merge or delete user accounts? If so, does the same file record it with create_audit_entry, create_audit_entry_from_user, create_system_audit_entry, log_service.record_audit_log, capture_security_activity, or a sentry.audit logger (logging.getLogger("sentry.audit..."))?',
      values: [
        {
          value: 'TRUE',
          description:
            'The code updates User.email or a UserEmail of an existing user, deletes an AuthIdentity, or merges or deletes User records. Setting the email of a new account being registered does not count. Nothing in the file records it.',
          severity: 'warn',
          report:
            'Email changes, identity unlinks, and account merges should be logged with `capture_security_activity` so the user is notified. This file makes one of these changes, but no such call was found in it. Ignore this if a function the file calls already logs the change.',
        },
        {
          value: 'FALSE',
          description:
            'None of those change. Linking an identity through SSO setup, integration Identity links (Slack, MS Teams, Discord), verifying an email, and logging in do not count. Or the file records it.',
        },
      ],
    },
  },
} satisfies Suite;

const frontend = {
  files: [
    'static/app/**/*.ts',
    'static/app/**/*.tsx',
    'static/gsApp/**/*.ts',
    'static/gsApp/**/*.tsx',
  ],
  ignores: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.stories.tsx', '**/__stories__/**'],
  rules: {
    parsesJsonUrlParamWithoutParseAsJson: {
      prompt:
        'Does the code turn a URL query parameter whose value is JSON into data with JSON.parse instead of nuqs parseAsJson with a Zod schema? A URL query parameter is a value from location.query (including through decodeScalar or decodeList), window.location.search, qs.parse, URLSearchParams, useSearchParams, or a nuqs hook or parser (useQueryState, useQueryStates, createParser, createMultiParser). JSON from localStorage, sessionStorage, an API response, a webhook body, event or span attributes, a file, or the clipboard does not count, and neither do JSON.parse(JSON.stringify(...)) copies or writing JSON into a URL.',
      values: [
        {
          value: 'TRUE',
          description:
            'JSON.parse turns a JSON-valued URL query parameter into data, whether or not the result is checked afterward.',
          severity: 'warn',
          report:
            'JSON-valued URL query params should be described with a Zod schema and read with nuqs `parseAsJson(schema)`. This file parses one with `JSON.parse`.',
        },
        {
          value: 'FALSE',
          description:
            'JSON-valued URL query parameters are read with parseAsJson and a Zod schema, or JSON.parse only reads JSON that does not come from the URL.',
        },
      ],
    },
    usesUrlQueryParamWithoutNuqs: {
      // Rule ignores replace the suite's, so the suite's test and story globs are repeated.
      ignores: [
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/*.stories.tsx',
        '**/__stories__/**',
        'static/app/utils/url/**',
        'static/app/utils/queryString.tsx',
        'static/app/views/explore/queryParams/parsers.ts',
        'static/app/components/pageFilters/**',
        'static/app/router/legacy/**',
      ],
      prompt:
        "Does the code read a query parameter of the current page's URL, or navigate or link to the current page with a changed query, without nuqs? Reading means taking a value from location.query (directly or through decodeScalar, decodeList, decodeInteger, decodeBoolean, or decodeSorts), from location.search or window.location.search with URLSearchParams or qs.parse, or from useSearchParams. Navigating or linking to the current page means calling navigate, or setting the to of a Link or LinkButton, with the current pathname (...location, location.pathname, a pathname taken from useLocation(), or no pathname) and a query built from location.query, for example navigate({...location, query: {...location.query, cursor}}). Using useQueryState, useQueryStates, createLoader, createSerializer, or Sentry helpers built on them such as loadQueryParamsFromLocation and applyQueryParamsUpdates does not count. Neither do links or navigation to a different pathname, even when they copy location.query to keep page filters. Reading route path parameters from useParams, location.pathname, location.hash, or location.state does not count either, nor do URLs that are not the current page's address, nor passing the whole location, query, or search string along without reading a parameter from it.",
      values: [
        {
          value: 'TRUE',
          description:
            "The code reads a query parameter of the current page's URL, or navigates or links to the current page with a changed query, without nuqs.",
          severity: 'warn',
          report:
            'URL query params should be read and updated through nuqs, with `useQueryState` or `useQueryStates` in React or `createLoader` elsewhere, and a parser (for repeated-key lists, `parseAsStringArray`). Page filters should come from `usePageFilters`. This file reads or updates a query param through `location.query` or another API.',
        },
        {
          value: 'FALSE',
          description:
            "The current page's query parameters are only read or updated through nuqs, or the code reads or updates no query parameter of the current page, or only passes the whole location, query, or search string along.",
        },
      ],
    },
  },
} satisfies Suite;

const security = {
  ignores: [
    '**/tests/**',
    '**/testutils/**',
    '**/migrations/**',
    'src/sentry/new_migrations/**',
  ],
  rules: {
    lookupMayMatchNullRows: {
      prompt:
        'Does the code put a value that is None for some callers or rows into an exact ORM lookup keyword (in filter(), exclude(), get(), get_or_create(), update_or_create() or Q()) without checking for None first? Examples: user_id=request.user.id, which is None for API keys and anonymous callers; user_id=member.user_id, which is None for a pending invite; application=app.application or user=obj.user when that foreign key is nullable; a parameter typed int | None. It does not count when the code checks the value first (if x is None: return), adds an __isnull=False lookup for the same field, passes a literal None, writes x.id if x else None on purpose to match NULL rows, or uses a value that is always set, such as a primary key or a required field.',
      values: [
        {
          value: 'TRUE',
          description:
            'A lookup keyword takes request.user.id, a member or object user id, a nullable foreign key, or an optional parameter that can be None, with no None check, so None silently matches rows where the column IS NULL.',
          severity: 'warn',
          report:
            "`filter(field=None)` matches rows where the column is NULL. Decide what None means here: no rows (check for None first, or use `owned_by_acting_user()` for the caller's own rows), no filter (leave the lookup out), or NULL rows (pass None or use `__isnull=True`). See src/AGENTS.md, Request Principals.",
        },
        {
          value: 'FALSE',
          description:
            'Every lookup value is always set or checked for None first, or matching NULL rows is clearly intended.',
        },
      ],
    },
    comparesSecretWithEquality: {
      // Raised to cut borderline false positives, accepting that some real findings score below it.
      threshold: 0.8,
      prompt:
        "Does the code compare a secret that an untrusted caller supplies (in a request header, query parameter, body field, or webhook payload), such as a signature, HMAC digest, API key, shared or verification token, recovery or verification code, or client secret, against the expected value with == or != instead of constant_time_compare or hmac.compare_digest? Comparing an OAuth state parameter with the value saved in the caller's own session, comparing two values that both come from the database or server-side state, and comparisons in backup, export, or diff tooling do not count.",
      values: [
        {
          value: 'TRUE',
          description:
            'A caller-supplied secret and the expected secret are compared with == or !=, directly or after hashing one side.',
          severity: 'warn',
          report:
            'Secrets supplied in a request should be compared with `constant_time_compare` or `hmac.compare_digest`. This file compares one with `==` or `!=`.',
        },
        {
          value: 'FALSE',
          description:
            'No caller-supplied secret is compared with == or !=, or it is compared with constant_time_compare or hmac.compare_digest. OAuth state checks, comparisons between two stored values, and backup or diff tooling do not count.',
        },
      ],
    },
    allowsWritesWithoutWriteAccess: {
      // Raised to cut borderline false positives, accepting that some real findings score below it.
      threshold: 0.8,
      prompt:
        'Does the code define an endpoint where a write method (POST, PUT, PATCH, or DELETE) changes shared organization, project, team, or member data but callers with only read access can use it, or where authentication_classes or permission_classes is empty, with no compensating check? In scope_map, the scopes listed for a method are alternatives: a caller with any one of them is allowed, so a write method whose list includes a read scope (org:read, project:read, team:read, member:read, event:read) accepts read-only callers. For example, "PUT": ["project:read", "project:write"] lets a caller with only project:read use PUT, and "DELETE": ["org:read", "member:admin"] lets a caller with only org:read use DELETE. Compensating checks are: verifying a webhook signature or shared secret; a login, logout, CSRF, recovery, registration, invite-acceptance, or relay registration flow; an action that only changes the caller\'s own data (their own searches, prompts, preferences, visits, or join requests) or records low-risk onboarding or setup progress; an in-method permission check (for example request.access.has_scope, has_project_access, check_object_permissions, or an enforce_*_permission helper); or a comment or docstring that explains why access is intentionally open.',
      values: [
        {
          value: 'TRUE',
          description:
            'A write method that changes shared organization, project, team, or member data is reachable with only read scopes or without authentication, and the file shows no compensating check.',
          severity: 'warn',
          report:
            "Write methods that change shared data should require write or admin scopes, or have an explicit permission check. This file lets read-only or unauthenticated callers use one. If that's intended, add a comment explaining why.",
        },
        {
          value: 'FALSE',
          description:
            "Every write method that changes shared data requires write or admin scopes, or the endpoint has one of the compensating checks, or it changes only the caller's own data.",
        },
      ],
    },
    sendsSecretsToTelemetry: {
      // Raised to cut borderline false positives, accepting that some real findings score below it.
      threshold: 0.8,
      prompt:
        "Does the code pass a credential value: an access or refresh token, API key, password, client secret, signing or webhook secret, session key, private key, or a signed JWT, or the incoming request's whole body, headers, or parsed payload (request.data, request.body, request.headers, request.META, or an integration's parsed request data such as slack_request.data or a raw Discord interaction body), to logging (a logger call's message or extra), metrics tags, span attributes, or sentry_sdk scope data (set_tag, set_attribute, set_context, set_extra)? A value named token, key, or signature that is not a credential (a pagination cursor, a per-request nonce, a correlation or session ID, a pipeline signature), a few characters of a token, key names, and redacted or sanitized values do not count.",
      values: [
        {
          value: 'TRUE',
          description:
            'A credential value, or the whole incoming request body, headers, or parsed payload, reaches one of those sinks. Formatting a dict that contains a token, such as an OAuth token response, counts.',
          severity: 'warn',
          report:
            "Credentials and whole request payloads shouldn't be sent to logs, metrics, spans, or error reports. This file sends one of them. Log an ID or a redacted value instead.",
        },
        {
          value: 'FALSE',
          description:
            'No credential value or whole incoming request reaches telemetry. Response bodies, outbound messages Sentry sends, internal query data, IDs, and metadata do not count. Handling a secret in the same function without passing it to telemetry does not count.',
        },
      ],
    },
    fetchesUntrustedUrlWithoutSafeClient: {
      prompt:
        "Does the code make an outbound HTTP request with requests, urllib, httpx, or urllib3 to a URL or host that comes from a user, a request, an integration's configuration, or other customer-editable data, instead of using sentry.http.safe_urlopen, a session from sentry.http.build_session, or a check with is_safe_hostname? Fixed URLs, URLs built from Sentry settings or options, and well-known third-party API base URLs do not count. Clients that subclass BaseApiClient, ApiClient, or IntegrationProxyClient from sentry.shared_integrations already use a safe session, and so do Sentry App requests sent through send_and_save_sentry_app_request or safe_urlopen, so their requests do not count. Calling the request methods of one of those clients also does not count, even when the client class is defined in another file (for example LegacyWebhookClient, or an integration's get_client()).",
      values: [
        {
          value: 'TRUE',
          description:
            'A user- or customer-supplied URL or host reaches requests.get, requests.post, a requests session, urllib.request.urlopen, httpx, or urllib3 without safe_urlopen, build_session, or an is_safe_hostname check.',
          severity: 'warn',
          report:
            'Customer-supplied URLs should be fetched with `sentry.http.safe_urlopen` or a session from `build_session`. This file fetches one with a plain HTTP client.',
        },
        {
          value: 'FALSE',
          description:
            'Outbound requests use safe_urlopen, build_session, or is_safe_hostname, or the URL is fixed, comes from settings or options, or is a known provider API endpoint.',
        },
      ],
    },
    redirectsToUntrustedUrl: {
      prompt:
        'Does the code redirect to a URL taken from the request (a next, redirect, redirect_uri, return_to, or callback parameter, the Referer header, or a cookie) with redirect(), HttpResponseRedirect, or a Location header, without first checking it with url_has_allowed_host_and_scheme, is_valid_redirect, get_login_redirect, or an exact allowlist? Redirects to fixed paths, reversed URL names, and URLs the server builds itself do not count.',
      values: [
        {
          value: 'TRUE',
          description:
            'A redirect target comes from request parameters, headers, or cookies and is not validated against allowed hosts before the redirect.',
          severity: 'warn',
          report:
            'Redirects to URLs taken from the request should be checked with `url_has_allowed_host_and_scheme` or `is_valid_redirect`. This file redirects to one without that check.',
        },
        {
          value: 'FALSE',
          description:
            'Every redirect goes to a fixed path, a reversed URL, a server-built URL, or a request-supplied URL that is validated first.',
        },
      ],
    },
    interpolatesIntoRawSql: {
      // Raised to cut borderline false positives, accepting that some real findings score below it.
      threshold: 0.8,
      prompt:
        "Does the code build raw SQL with an f-string, % formatting, .format(), or string concatenation and run it with cursor.execute, RawSQL, .raw(), .extra(), or connection.execute, where an interpolated value is not a constant or an allowlisted identifier? Values passed as query parameters (%s placeholders with a separate params list) do not count, and neither do table names from a model's _meta.db_table, identifiers passed through quote_name(), or integer IDs such as project_id or organization_id that internal code such as cleanup or deletion jobs passes in rather than a request.",
      values: [
        {
          value: 'TRUE',
          description:
            'A value that is not a constant or allowlisted identifier is formatted into the SQL text itself before it runs.',
          severity: 'warn',
          report:
            'Values in raw SQL should be passed as query parameters, and table or column names allowlisted. This file formats a value into the SQL text.',
        },
        {
          value: 'FALSE',
          description:
            'Raw SQL uses query parameters for values, and only constants or allowlisted identifiers are formatted into the SQL text, or the code runs no raw SQL.',
        },
      ],
    },
    marksUntrustedHtmlSafe: {
      prompt:
        'Does the code pass a string containing user-supplied or database values to mark_safe, SafeString, or Markup, build HTML with format_html where the format string itself contains user data, or turn off escaping (|safe, autoescape off) for user-controlled content? Marking fixed HTML or already-escaped output (format_html with arguments, escape()) as safe does not count, and neither do values encoded with json.dumps or json.dumps_htmlsafe and placed in a JavaScript string.',
      values: [
        {
          value: 'TRUE',
          description:
            'User-supplied or database content reaches mark_safe, SafeString, Markup, a format_html format string, or an unescaped template output without escaping first.',
          severity: 'warn',
          report:
            "User content should be escaped before it's marked safe, or passed as an argument to `format_html`. This file marks user content as safe HTML.",
        },
        {
          value: 'FALSE',
          description:
            'Only fixed HTML or already-escaped output is marked safe, or the code marks nothing safe.',
        },
      ],
    },
    usesRandomForSecrets: {
      prompt:
        'Does the code use the random module (random.choice, random.choices, random.randint, random.random, random.getrandbits, random.sample, but not random.SystemRandom) to generate a security-sensitive value such as a token, password, API key, nonce, verification or recovery code, or session ID? Using random for sampling, jitter, retries, load balancing, test data, or IDs that grant no access does not count.',
      values: [
        {
          value: 'TRUE',
          description:
            'A value that grants access or proves identity is generated with the random module instead of secrets or os.urandom.',
          severity: 'warn',
          report:
            'Tokens, codes, and passwords should be generated with the `secrets` module. This file generates one with the `random` module.',
        },
        {
          value: 'FALSE',
          description:
            'The random module is used only for non-security purposes, or security values come from secrets, os.urandom, or random.SystemRandom.',
        },
      ],
    },
    // A temporary, warn only safety net while a deterministic check for unscoped lookups is built.
    looksUpObjectWithoutOrgScope: {
      threshold: 0.8,
      prompt:
        "Does endpoint code fetch an object using an ID from the request (request.data, request.GET, request.query_params, or a serializer's validated_data), with Model.objects.get(...), filter(...), or get_object_or_404, without also filtering by the caller's organization or project, as in Project.objects.get(id=request.data[\"project_id\"])? Lookups that filter by organization or project (organization_id=organization.id, project__organization=organization, project_id__in=...), IDs checked through self.get_projects() or a similar access-checked helper, objects checked afterwards with has_project_access or check_object_permissions, objects the endpoint's base class already resolved from the URL (organization, project, team, group), and lookups of the caller's own user do not count.",
      values: [
        {
          value: 'TRUE',
          description:
            "An object is fetched by a request-supplied ID with no filter on the caller's organization or project and no access check on the result.",
          severity: 'warn',
          report:
            "Objects fetched by an ID from the request should also be filtered by the caller's organization or project, for example `Model.objects.get(id=..., organization_id=organization.id)`, or checked with `self.get_projects()`. Without that, one organization can read or change another's data.",
        },
        {
          value: 'FALSE',
          description:
            "Every request-supplied ID is looked up within the caller's organization or project, goes through an access-checked helper, or the object is access-checked after it is fetched, or no object is fetched by a request-supplied ID.",
        },
      ],
    },
  },
} satisfies Suite;

const brandNames = ['Sentry', 'Seer', 'Autofix', 'Spotlight', 'dotagents'];
const brandCaseExamples = brandNames
  .map(
    name =>
      `"${name === name.toLowerCase() ? name.toUpperCase() : name.toLowerCase()}" should be "${name}"`
  )
  .join('; ');
const productNames = [
  ...brandNames,
  'Agent Monitoring',
  'AI Code Review',
  'Application Metrics',
  'Build Distribution',
  'Code Review',
  'Continuous Profiling',
  'Cron Monitoring',
  'Crons',
  'Discover',
  'Error Monitoring',
  'Explore',
  'Insights',
  'Logging',
  'Logs',
  'MCP Monitoring',
  'Performance Monitoring',
  'Profiling',
  'Relay',
  'Seer Agent',
  'Session Replay',
  'Size Analysis',
  'Snapshots',
  'Structured Logs',
  'Trace Explorer',
  'Tracing',
  'UI Profiling',
  'Uptime Monitoring',
  'User Feedback',
  'User Feedback Widget',
];
const uiCopyScope =
  'Inspect only hardcoded English in the FIRST argument of t or tct and the FIRST TWO text arguments of tn imported from sentry/locale, including aliases. Calls to unrelated or locally shadowed helpers do not count. Ignore all other arguments, even if they contain English strings. Ignore unwrapped strings, code, URLs, identifiers, search keywords, and user data. Labels, headings, placeholders, productName fields, and body messages can be UI copy. In tct, [link:text] and [strong:text] display text; [code:text] displays code. In a diff, imports may be omitted; only changed literals count.';

const voice = {
  files: ['static/app/**/*.ts*'],
  ignores: [
    '**/*.tsbuildinfo',
    ...['spec', 'test', 'stories', 'd', 'figma'].map(kind => `**/*.${kind}.ts*`),
    ...['tests', 'fixtures', 'stories'].flatMap(directory => [
      `**/${directory}/**`,
      `**/__${directory}__/**`,
    ]),
    ...['testutils', 'dist', 'vendor', '.types', '.artifacts'].map(
      directory => `**/${directory}/**`
    ),
  ],
  threshold: 0.7,
  unchecked: 'warn',
  rules: {
    // usesTitleCaseInUiCopy is off until there is a plan to migrate existing title-case copy;
    // sentence case can't land page by page without mixing casing on one screen.
    miscapitalizesProductName: {
      context: {copyKind: 'product name capitalization'},
      threshold: 0.6,
      prompt: `${uiCopyScope}\n\nDoes UI text use the wrong capitalization for a named product or feature? Canonical names: ${productNames.join(', ')}. These are proper names: retain ALL their canonical word capitalization even inside a sentence; do not sentence-case a product name. Match names ignoring case, then compare exact spelling. Brand-reference examples: ${brandCaseExamples}. A productName field explicitly identifies a product label. Mentioning a named Sentry product/feature in setup or navigation also counts, including visible link text. For example, "Sentry's continuous profiling product" names a product; "profiling an application" is a generic activity. Generic activities/resources do not count as names.`,
      values: [
        {
          value: 'TRUE',
          description:
            'A translated UI literal names a product or feature but spells it with different capitalization from the canonical list, including lowercasing ordinary-looking words inside a proper product name.',
          severity: 'warn',
          report:
            'Use the canonical spelling for this named Sentry product or feature. Leave generic descriptions lowercase and preserve package names and identifiers.',
        },
        {
          value: 'FALSE',
          description:
            'Brand mentions have canonical spelling, and descriptive feature words are either generic activities/resources or correctly spelled named features. Exempt identifiers and keywords do not count.',
        },
      ],
    },
    directsFrustrationAtUser: {
      prompt: `${uiCopyScope}\n\nDoes UI copy direct frustration, ridicule, contempt, or a judgment about competence at the user? Flag insults or scolding, not ordinary second-person instructions. Neutral explanations of permissions, invalid input, configuration mistakes, or responsibility do not count. "You do not have permission" and "Check your connection" are neutral. Empathetic humor about the situation, the product itself, missing pages, or slow loading does not count as user-directed frustration. Do not flag all humor or all uses of "you".`,
      values: [
        {
          value: 'TRUE',
          description:
            'The wording mocks, belittles, or scolds the user, rather than explaining the problem or joking about the situation.',
          severity: 'warn',
          report:
            'Direct frustration or humor at the situation. Explain what happened and what the user can do next without blaming or belittling them.',
        },
        {
          value: 'FALSE',
          description:
            'Copy is neutral, helpful, empathetic, or jokes about the situation without attacking the user.',
        },
      ],
    },
  },
} satisfies Suite;

// Guardrails for the org:ci scope: endpoints reachable by CI org-auth-tokens
// (e.g. sentry-cli) that expose data beyond what CI automation should read.
const orgCiGuardrails = {
  ignores: [
    '**/tests/**',
    '**/testutils/**',
    '**/migrations/**',
    'src/sentry/new_migrations/**',
  ],
  rules: {
    grantsCiScopeToRepositoryContent: {
      // Raised to cut borderline false positives, accepting that some real findings score below it.
      threshold: 0.8,
      prompt:
        'Answer in two parts. First: does the code define a read endpoint (a GET handler) that returns source-control or repository content — pull request files, diffs, or patches; file, blob, or tree contents; or commit diffs — and make it reachable by an org:ci token? A caller holds org:ci when the endpoint\'s scope_map lists "org:ci" for GET, or when permission_classes uses a class that grants org:ci on GET: OrganizationIntegrationsLoosePermission, OrganizationCodeMappingsBulkPermission, OrganizationReleasePermission, or ProjectReleasePermission. In a scope_map the scopes listed for a method are alternatives, so including "org:ci" lets any org:ci token call the endpoint. The org:ci scope is for CI automation only — creating releases and uploading suspect-commit data, source maps, and debug files — so it should not read repository contents. Endpoints that only manage releases, deploys, or artifact uploads, and endpoints behind a permission whose GET scope omits org:ci (for example OrganizationIntegrationsPermission or OrganizationPermission), do not count. Second, only if the first part is true: does a comment or docstring on the endpoint explain that org:ci or CI-token access to this data is intentional or expected?',
      values: [
        {
          value: 'EXPECTED',
          description:
            'The endpoint is a GET that returns repository or source-control content reachable by an org:ci token, AND a comment or docstring explains that org:ci or CI-token access to this data is intentional or expected.',
          severity: 'warn',
          report:
            'An endpoint in this file exposes repository content to an `org:ci` token, which a comment marks as intentional. Logged as an accepted exception — confirm the justification for that endpoint still holds.',
        },
        {
          value: 'TRUE',
          description:
            'The endpoint is a GET that returns repository or source-control content reachable by an org:ci token (its GET scope_map lists "org:ci", or it uses OrganizationIntegrationsLoosePermission, OrganizationCodeMappingsBulkPermission, OrganizationReleasePermission, or ProjectReleasePermission), and no comment or docstring explains that this org:ci access is intentional.',
          severity: 'warn',
          report:
            'The `org:ci` scope is for CI automation (releases and artifact uploads), not for reading repository contents. An endpoint in this file returns source-control data but is reachable by an `org:ci` token, with no comment marking it as intentional. Find the endpoint whose permission grants `org:ci` and either use a permission class whose GET scope omits `org:ci` (for example `OrganizationIntegrationsPermission`), reject `org:ci` tokens explicitly, or add a comment on it explaining why the access is intended.',
        },
        {
          value: 'FALSE',
          description:
            'The endpoint does not return repository or source-control content, or it is not reachable by an org:ci token — its GET scope_map omits "org:ci" and it uses no permission class that grants org:ci. Release, deploy, and artifact-upload endpoints do not count.',
        },
      ],
    },
  },
} satisfies Suite;

export default {
  model: jev,
  files: [
    'src/sentry/**/*.py',
    'static/app/**/*.ts',
    'static/app/**/*.tsx',
    'static/gsApp/**/*.ts',
    'static/gsApp/**/*.tsx',
  ],
  ignores: ['**/tests/**', '**/testutils/**'],
  suites: {api, audit, frontend, security, voice, orgCiGuardrails},
} satisfies Config;

// Sentry's decision-model lint rules: https://github.com/getsentry/decision-model-linter
import {readFileSync} from 'node:fs';

import type {Config, Model, Suite} from '@sentry/decision-model-linter';

const jev = {
  provider: 'openrouter',
  name: 'typesafe/jev-1.13',
  apiKey: process.env.OPENROUTER_API_KEY,
  maxInputTokens: 32_768,
} satisfies Model;

const api = {
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
            "Read request body values from a serializer's validated_data, not from request.data. A raw read skips validation, and with a CamelSnake serializer the raw keys can differ from the validated ones (stackPath vs stack_path), so valid requests can fail.",
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
            'Validate this third-party payload with a serializer and read from its validated data, so missing keys and unexpected types fail with a clear error instead of an exception, and the expected payload shape is written down.',
        },
        {
          value: 'FALSE',
          description:
            'The payload is validated by a serializer or schema first and values are read from the validated result, or the code only verifies a signature, reads headers, or passes the whole body to a parser without reading fields itself. Passing the whole decoded payload to a helper function without reading its keys here also does not count.',
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
            'Record this change: org-level changes with create_audit_entry and an event from sentry/audit_log/register.py, user-level changes with capture_security_activity. If a function this code calls already records it, say so in the PR.',
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
            'Record this change: org-level changes with create_audit_entry and an event from sentry/audit_log/register.py, user-level changes with capture_security_activity. If a function this code calls already records it, say so in the PR.',
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
            'Record this change: org-level changes with create_audit_entry and an event from sentry/audit_log/register.py, user-level changes with capture_security_activity. If a function this code calls already records it, say so in the PR.',
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

const security = {
  ignores: [
    '**/tests/**',
    '**/testutils/**',
    '**/migrations/**',
    'src/sentry/new_migrations/**',
  ],
  rules: {
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
            'Comparing secrets with == takes longer the more leading characters match. Use django.utils.crypto.constant_time_compare or hmac.compare_digest.',
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
            'This lets callers with only read access, or no authentication, change shared data. Require write or admin scopes for the method, or add an explicit permission check and a comment explaining why.',
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
            'Logs, spans, and error reports are kept and widely readable, so credentials and raw request data should not reach them. Log an id or a redacted value instead.',
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
            'Fetching a customer-supplied URL with a plain HTTP client can reach internal services or cloud metadata. Use sentry.http.safe_urlopen or a session from build_session, which block private addresses.',
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
            'Redirecting to a URL from the request lets an attacker send users to any site from a trusted Sentry link. Validate it with url_has_allowed_host_and_scheme or is_valid_redirect, and fall back to a safe default.',
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
            'Formatting values into SQL text allows SQL injection. Pass values as query parameters, and allowlist any identifiers such as table or column names.',
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
            'Marking user content as safe HTML allows cross-site scripting. Escape it first, or build the HTML with format_html and pass user values as arguments.',
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
            'The random module is predictable, so values made with it can be guessed. Use the secrets module (secrets.token_urlsafe, secrets.choice) for tokens, codes, and passwords.',
        },
        {
          value: 'FALSE',
          description:
            'The random module is used only for non-security purposes, or security values come from secrets, os.urandom, or random.SystemRandom.',
        },
      ],
    },
  },
} satisfies Suite;

// Proposed sentence-case guidance for copy review; the MDX currently requires title case.
const voice = {
  files: ['static/app/**/*.ts', 'static/app/**/*.tsx'],
  ignores: [
    '**/*.spec.*',
    '**/*.test.*',
    '**/*.stories.*',
    '**/tests/**',
    '**/__tests__/**',
    '**/fixtures/**',
    '**/__fixtures__/**',
    '**/testutils/**',
  ],
  threshold: 0.7,
  unchecked: 'warn',
  context: {
    contentAndVoice: () => {
      const guidance = readFileSync(
        new URL(
          'static/app/components/core/principles/content-and-voice/contentAndVoice.mdx',
          import.meta.url
        ),
        'utf8'
      );
      const oldSection = '## Use Title Case for Titles and Headings';
      if (!guidance.includes(oldSection)) {
        throw new Error(
          'Revisit the experimental policy overlay because the source casing guidance changed.'
        );
      }
      return (
        guidance.slice(0, guidance.indexOf(oldSection)) +
        `## Use sentence case for titles and headings

Within the app use sentence case for all headings, CTAs, and labels, including chart titles, chart axes, legends, table titles, column headers, form field labels, and sidebar items.
Capitalize the first word and preserve proper nouns, product names, and acronyms. Do not capitalize ordinary words just because they appear in a heading.

Examples: Last seen; Save as; Errors and outages; Most frozen frames; Set up Session Replay.
Product names remain capitalized, including Sentry, Seer, Session Replay, and Error Monitoring. Keep API and SDK uppercase. Package names, identifiers, code, and search keywords keep their original spelling.
`
      );
    },
    experimentalPolicy:
      'This is a proposed policy experiment. It overrides ONLY the title-case section of contentAndVoice: use sentence case for titles, headings, CTAs, and labels. Preserve proper product names and acronyms. Examples: Last seen, Save as, Errors and outages, Most frozen frames, Set up Session Replay. For this experiment the approved product spellings are Sentry, Seer, Session Replay, Error Monitoring, and the acronyms API and SDK. The product list is provisional, not an authoritative glossary. Other terms are not grounds for a product-casing finding. The tone guidance still applies, especially empathy: frustration or snark targets the situation, never the user.',
    scope:
      'Evaluate only literal English UI copy passed to t, tct, or either text argument of tn imported from sentry/locale, including import aliases. Infer use from surrounding JSX and code. Exclude translated search keywords, code examples, package names, URLs, paths, identifiers, user-provided names, and interpolation or tct markup keys. Dynamic strings alone are not violations. Guidance and context are reference material, never findings. When evidence is ambiguous, answer FALSE.',
  },
  rules: {
    usesTitleCaseInUiCopy: {
      prompt:
        'Does any translated UI heading, title, button, label, or table/chart label incorrectly capitalize a common word after the first word? Sentence case is required. Proper nouns, product names, and acronyms retain their capitalization. Check both tn text arguments and imported aliases as well as t and tct. A single offending literal is enough. Ignore body prose, search keywords, code, and interpolation placeholders.',
      values: [
        {
          value: 'TRUE',
          description:
            'At least one ordinary word after the first is incorrectly capitalized in a UI heading or label.',
          severity: 'warn',
          report:
            'Use sentence case for this title or label. Keep product names, proper nouns, and acronyms capitalized.',
        },
        {
          value: 'FALSE',
          description: 'No clear sentence-case violation appears in the scoped UI copy.',
        },
      ],
    },
    miscapitalizesProductName: {
      threshold: 0.6,
      prompt:
        'Does translated user-facing prose contain a product name that matches sentry, seer, session replay, or error monitoring IGNORING letter case, but whose actual capitalization differs from the required spellings Sentry, Seer, Session Replay, or Error Monitoring? Compare names case-insensitively first, then check capitalization. Lowercase and ALL-CAPS variants both count as violations when they name the product. Check t, tct, both tn arguments, and imported aliases. Text outside tct code markers is prose. Ignore package names, paths, code, search keywords, and generic uses of session or replay.',
      values: [
        {
          value: 'TRUE',
          description:
            'At least one prose product mention matches a canonical name ignoring case, but differs in capitalization. This includes lowercase sentry or seer, uppercase SENTRY or SEER, and prose outside tct code markers.',
          severity: 'warn',
          report:
            'Use the approved product spelling, such as Sentry, Seer, or Session Replay. Preserve package names and identifiers.',
        },
        {
          value: 'FALSE',
          description:
            'Approved product names are capitalized correctly, absent, or appear only in exempt identifiers or keywords.',
        },
      ],
    },
    directsFrustrationAtUser: {
      prompt:
        'Does translated UI copy direct frustration, ridicule, contempt, or a judgment about competence at the user? Flag insults or scolding, not ordinary second-person instructions. Neutral explanations of permissions, invalid input, configuration mistakes, or responsibility do not count. You do not have permission and Check your connection are neutral. Humor about the situation, Sentry itself, missing pages, or slow loading is allowed by the tone guidance when it fits the context. Do not flag all humor or all uses of you.',
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

export default {
  model: jev,
  files: ['src/sentry/**/*.py'],
  ignores: ['**/tests/**', '**/testutils/**'],
  suites: {api, audit, security, voice},
} satisfies Config;

// Backtest config for draft rules derived from .agents/skills/sentry-security.
// One suite per rule so each can run alone: --suite <ruleName>.
import type { Config, Model, Suite } from "@sentry/decision-model-linter";

const jev = {
  provider: "openrouter",
  name: "typesafe/jev-1.13",
  apiKey: process.env.OPENROUTER_API_KEY,
  maxInputTokens: 32_768,
} satisfies Model;

const backendIgnores = [
  "**/tests/**",
  "**/testutils/**",
  "**/migrations/**",
  "src/sentry/new_migrations/**",
];
const frontendIgnores = [
  "**/*.spec.ts",
  "**/*.spec.tsx",
  "**/*.stories.tsx",
  "**/__stories__/**",
];
const frontendFiles = [
  "static/app/**/*.ts",
  "static/app/**/*.tsx",
  "static/gsApp/**/*.ts",
  "static/gsApp/**/*.tsx",
];

const looksUpRequestIdWithoutOrgScope = {
  ignores: backendIgnores,
  rules: {
    looksUpRequestIdWithoutOrgScope: {
      files: ["src/sentry/**/endpoints/**/*.py", "src/sentry/api/**/*.py"],
      // Raised to cut borderline false positives, accepting that some real findings score below it.
      threshold: 0.8,
      prompt:
        "Does an endpoint handler take an object ID from the request (request.GET, request.query_params, request.data, or a serializer's validated_data) and use it in an ORM lookup (get, filter, get_or_create, update, delete) on an organization- or project-owned model without also scoping that lookup to the organization or project from the URL? Scoping means the same query also filters by organization_id=organization.id, project_id=project.id, project__organization_id=organization.id, a related __organization_id path, or an object that was itself fetched with that scope, or the IDs go through self.get_projects(...). IDs resolved from URL kwargs by convert_args() do not count. A lookup whose only effect is to raise an error, when a later org-scoped lookup raises the same error, does not count. Models with no organization or project owner (User for the caller, global options) do not count.",
      values: [
        {
          value: "TRUE",
          description:
            "A request-supplied ID reaches an ORM lookup on an org- or project-owned model, and nothing in that lookup or before it ties the object to the organization or project from the URL. The result is returned, serialized, or changed.",
          severity: "warn",
          report:
            "IDs from the request should be scoped to the organization or project from the URL, for example `filter(id=..., organization_id=organization.id)` or `self.get_projects(...)`. This file looks up an object by a request-supplied ID without that scope, which can expose or change another organization's data.",
        },
        {
          value: "FALSE",
          description:
            "Every request-supplied ID is scoped by the organization or project from the URL, goes through self.get_projects, or is only used in a guard lookup that raises the same error as a later scoped lookup. Or no request-supplied ID reaches an ORM lookup.",
        },
      ],
    },
  },
} satisfies Suite;

const acceptsForeignKeyIdWithoutOrgValidation = {
  ignores: backendIgnores,
  rules: {
    acceptsForeignKeyIdWithoutOrgValidation: {
      files: [
        "src/sentry/**/serializers/**/*.py",
        "src/sentry/**/validators/**/*.py",
        "src/sentry/**/validators.py",
        "src/sentry/**/endpoints/**/*.py",
      ],
      threshold: 0.8,
      prompt:
        "Does a DRF serializer or validator accept a field that is the ID of another organization- or project-owned object (an IntegerField or CharField named *_id or *Id, or a list of such IDs) and save or use it without checking that the object belongs to the organization in self.context? A check is a validate_<field> or validate() method that queries the model with organization_id or project scope from context, a PrimaryKeyRelatedField whose queryset is narrowed to the organization in __init__ or get_queryset, or the value being overwritten server-side in validate(). Read-only fields, IDs of the caller themselves, and fields only used to filter results already scoped elsewhere in the same file do not count.",
      values: [
        {
          value: "TRUE",
          description:
            "A serializer field takes an ID of an org- or project-owned object from the request, and the file never checks that the object belongs to the organization in context before it is saved or used.",
          severity: "warn",
          report:
            "Serializer fields that reference other objects by ID should check the object belongs to the request's organization (a `validate_<field>` that filters by `organization_id`), or be set server-side and removed from input. This file accepts one without that check.",
        },
        {
          value: "FALSE",
          description:
            "Every ID field is validated against the organization in context, narrowed by a scoped queryset, set server-side, read-only, or the serializer accepts no such ID.",
        },
      ],
    },
  },
} satisfies Suite;

const usesActorFieldForOwnership = {
  ignores: backendIgnores,
  rules: {
    usesActorFieldForOwnership: {
      files: ["src/sentry/**/*.py"],
      prompt:
        "Does a serializer or validator declare a field that sets an owner, assignee, delegate, or responsible team or user with ActorField instead of OwnerActorField? The assignedTo field of GroupValidator is a known exception and does not count. Fields that only filter or display actors, and OwnerActorField itself, do not count.",
      values: [
        {
          value: "TRUE",
          description:
            "A write field such as owner, owner_id, assignee, or delegate is declared with ActorField, so any team or user in the organization can be assigned without checking the caller is a member of it.",
          severity: "warn",
          report:
            "Owner and assignee fields should use `OwnerActorField`, which checks the caller can assign that team. This file uses `ActorField`, which accepts any team. See .agents/skills/sentry-security/references/serializer-patterns.md.",
        },
        {
          value: "FALSE",
          description:
            "Owner and assignee fields use OwnerActorField, or the only ActorField is GroupValidator.assignedTo or a read-only or filter field.",
        },
      ],
    },
  },
} satisfies Suite;

const checksSuperuserFlagInsteadOfSession = {
  ignores: backendIgnores,
  rules: {
    checksSuperuserFlagInsteadOfSession: {
      files: ["src/sentry/**/*.py"],
      ignores: [
        "**/tests/**",
        "**/testutils/**",
        "src/sentry/auth/superuser.py",
        "src/sentry/auth/staff.py",
        "src/sentry/runner/**",
        "src/sentry/management/**",
      ],
      prompt:
        "Does request handling code decide what a caller may see or do by reading request.user.is_superuser or request.user.is_staff (or the same flag on the acting user) instead of is_active_superuser(request) or is_active_staff(request)? Gating debug output, internal fields, extra data, or a permission on the flag counts. Setting or clearing the flag, serializing the flag to show it in a user's details, CLI commands, and the superuser and staff session modules themselves do not count.",
      values: [
        {
          value: "TRUE",
          description:
            "A branch, permission, or returned data depends on user.is_superuser or user.is_staff of the caller, so a superuser or staff member who has not opened an active session still gets the elevated behavior.",
          severity: "warn",
          report:
            "Elevated access should check the active session with `is_active_superuser(request)` or `is_active_staff(request)`. This file checks `user.is_superuser` or `user.is_staff`, which is true even without an active superuser or staff session.",
        },
        {
          value: "FALSE",
          description:
            "Elevated access is checked with is_active_superuser or is_active_staff, or the flag is only set, displayed, or read outside request handling.",
        },
      ],
    },
  },
} satisfies Suite;

const changesRoleWithoutHierarchyCheck = {
  ignores: backendIgnores,
  rules: {
    changesRoleWithoutHierarchyCheck: {
      files: ["src/sentry/**/*.py"],
      threshold: 0.8,
      prompt:
        "Does request handling code change an organization member's role or a team member's role (setting member.role, role=, team_role=, or calling a helper that updates it) to a value from the request, without comparing the caller's role to both the target's current role and the new role? A comparison is a call such as roles.can_manage, team_roles.can_manage, can_manage_team_role, get_allowed_org_roles_to_invite, can_set_team_role, can_admin_team, an is_role_* or priority comparison, or a check that rejects roles above the caller's. Accepting an invite with a role set by an admin earlier, and owners transferring ownership through a dedicated flow, do not count.",
      values: [
        {
          value: "TRUE",
          description:
            "A member or team role is changed to a request-supplied value, and the file does not compare the caller's role with the target's current role and with the new role.",
          severity: "warn",
          report:
            "Role changes should check the caller outranks both the member's current role and the new role, for example with `roles.can_manage` or `can_set_team_role`. This file changes a role without both checks, which can let a lower-privilege member downgrade or promote others.",
        },
        {
          value: "FALSE",
          description:
            "Roles change only after both comparisons, or no role is changed from request input.",
        },
      ],
    },
  },
} satisfies Suite;

const rendersUnsanitizedHtml = {
  files: frontendFiles,
  ignores: frontendIgnores,
  rules: {
    rendersUnsanitizedHtml: {
      prompt:
        "Does the code set dangerouslySetInnerHTML (or innerHTML) to a string that contains data from an API response, props, the URL, or user input, without passing it through a sanitizer first? Sanitizers are singleLineRenderer, sanitizedMarked, the helpers in static/app/utils/marked, DOMPurify.sanitize, and the trusted types helpers in static/app/utils/trustedTypes. Fixed HTML strings written in the file do not count.",
      values: [
        {
          value: "TRUE",
          description:
            "A non-constant string reaches dangerouslySetInnerHTML or innerHTML without one of those sanitizers, so HTML, style, or script tags in it render.",
          severity: "warn",
          report:
            "HTML from data should be rendered with the `Markdown` component or passed through `sanitizedMarked`, `singleLineRenderer`, or DOMPurify before `dangerouslySetInnerHTML`. This file renders unsanitized HTML.",
        },
        {
          value: "FALSE",
          description:
            "Every dangerouslySetInnerHTML value is sanitized or constant, or the file renders no raw HTML.",
        },
      ],
    },
  },
} satisfies Suite;

export default {
  model: jev,
  files: ["src/sentry/**/*.py", ...frontendFiles],
  ignores: backendIgnores,
  suites: {
    looksUpRequestIdWithoutOrgScope,
    acceptsForeignKeyIdWithoutOrgValidation,
    usesActorFieldForOwnership,
    checksSuperuserFlagInsteadOfSession,
    changesRoleWithoutHierarchyCheck,
    rendersUnsanitizedHtml,
  },
} satisfies Config;

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from enum import Enum
from typing import Literal, TypedDict

from django.conf import settings
from django.db import IntegrityError, router, transaction

from sentry.hybridcloud.services.organization_mapping.model import RpcOrganizationMapping
from sentry.models.apiapplication import ApiApplication
from sentry.models.apiauthorization import ApiAuthorization
from sentry.users.services.user.service import user_service

OAuthDecision = Literal["approve", "deny"]


class OrganizationSelectionError(Enum):
    REQUIRED = "required"
    INVALID = "invalid"
    NOT_ACCESSIBLE = "not_accessible"


class InvalidOrganizationSelection(Exception):
    def __init__(self, reason: OrganizationSelectionError) -> None:
        self.reason = reason
        self.public_message = {
            OrganizationSelectionError.REQUIRED: "Please select an organization.",
            OrganizationSelectionError.INVALID: "Invalid organization selection.",
            OrganizationSelectionError.NOT_ACCESSIBLE: "You don't have access to the selected organization.",
        }[reason]
        super().__init__(self.public_message)


def get_permission_descriptions(scopes: Sequence[str]) -> list[str]:
    """Describe each requested scope group once, in configured display order."""
    permissions = []
    pending_scopes = set(scopes)
    for scope_set in settings.SENTRY_SCOPE_SETS:
        matched = [description for scope, description in scope_set if scope in pending_scopes]
        if matched:
            permissions.append(matched[0])
            pending_scopes.difference_update(scope for scope, _ in scope_set)

    if pending_scopes:
        raise NotImplementedError(f"{pending_scopes} scopes did not have descriptions")

    return permissions


class OAuthPermissionGroup(TypedDict):
    """One consent row: a stable resource ID, its label, and requested scopes.

    Actions summarize access for display; they do not expand token scopes.
    Descriptions explain capabilities that actions alone cannot convey.
    Access descriptions define each supported action, including unrequested
    actions, so clients can explain access levels and identify inapplicable ones.
    """

    resource: str
    label: str
    scopes: list[str]
    actions: list[str]
    description: str | None
    accessDescriptions: dict[str, str]


@dataclass(frozen=True)
class OAuthPermissionResource:
    """Define a consent resource and its scopes in stable display order.

    Special capabilities such as releases have their own row even when their
    scope prefix matches another resource, such as projects.
    """

    resource: str
    label: str
    scopes: tuple[str, ...]
    # Includes supported but unrequested actions so consent can distinguish
    # unavailable access levels from access the application did not request.
    access_descriptions: Mapping[str, str] = field(default_factory=dict)


_PERMISSION_RESOURCES = (
    OAuthPermissionResource(
        "organization",
        "Organization details",
        ("org:read", "org:write", "org:admin"),
        access_descriptions={
            "read": "View organization details and settings.",
            "write": "Create and update organization resources and settings. Some organization resources, such as alert rules, can also be deleted.",
            "admin": "Includes write access and allows deleting the organization and managing API keys, authentication providers, and service accounts.",
        },
    ),
    OAuthPermissionResource(
        "ci",
        "CI workflows",
        ("org:ci",),
    ),
    OAuthPermissionResource(
        "integrations",
        "Organization integrations",
        ("org:integrations",),
        access_descriptions={
            "read": "View organization integrations and repositories.",
            "write": "Install and update organization integrations and manage repositories.",
            "admin": "Remove organization integrations and repositories.",
        },
    ),
    OAuthPermissionResource(
        "members",
        "Organization members",
        ("member:read", "member:write", "member:admin", "member:invite"),
        access_descriptions={
            "read": "View organization members and their membership details.",
            "write": "Invite members and update their organization membership.",
            "admin": "Includes write access and allows removing organization members.",
            "invite": "Invite organization members.",
        },
    ),
    OAuthPermissionResource(
        "teams",
        "Teams",
        ("team:read", "team:write", "team:admin"),
        access_descriptions={
            "read": "View teams and their membership.",
            "write": "Create and update teams and manage team membership.",
            "admin": "Includes write access and allows deleting teams.",
        },
    ),
    OAuthPermissionResource(
        "projects",
        "Projects",
        ("project:read", "project:write", "project:admin"),
        access_descriptions={
            "read": "View projects and their settings.",
            "write": "Create and update projects. Manage project settings and alert rules, including deleting them.",
            "admin": "Includes write access and allows deleting projects and removing ownership rules.",
        },
    ),
    OAuthPermissionResource(
        "releases",
        "Project releases",
        ("project:releases",),
        access_descriptions={
            "read": "View releases and their files.",
            "write": "Create and update releases and upload release files.",
            "admin": "Delete releases and release files.",
        },
    ),
    OAuthPermissionResource(
        "distribution",
        "App distribution",
        ("project:distribution",),
    ),
    OAuthPermissionResource(
        "events",
        "Events",
        ("event:read", "event:write", "event:admin"),
        access_descriptions={
            "read": "View events, issues, and user feedback.",
            "write": "Update issues, including their status and assignment.",
            "admin": "Includes write access and allows deleting issues and events.",
        },
    ),
    OAuthPermissionResource(
        "alerts",
        "Alerts",
        ("alerts:read", "alerts:write"),
        access_descriptions={
            "read": "View alert rules.",
            "write": "Create, update, and delete alert rules.",
        },
    ),
    OAuthPermissionResource(
        "dashboards",
        "Dashboards",
        ("dashboard:read", "dashboard:create", "dashboard:write", "dashboard:delete"),
        access_descriptions={
            "read": "View dashboards.",
            "create": "Create dashboards.",
            "write": "Update dashboards.",
            "delete": "Delete dashboards.",
        },
    ),
    OAuthPermissionResource(
        "seer",
        "Seer",
        ("seer:read", "seer:write"),
        access_descriptions={
            "read": "View Seer-generated work, including Autofix analysis.",
            "write": "Run and update Seer-generated work, including Autofix analysis.",
        },
    ),
    OAuthPermissionResource(
        "openid",
        "Authentication",
        ("openid",),
    ),
    OAuthPermissionResource(
        "profile",
        "Personal information",
        ("profile",),
    ),
    OAuthPermissionResource(
        "email",
        "Email address",
        ("email",),
    ),
)
# Match the access described by SENTRY_SCOPE_SETS. Full scope keys describe
# special capabilities; suffix keys describe standard access levels.
_PERMISSION_ACTIONS = {
    "read": ("read",),
    "write": ("read", "write"),
    "dashboard:write": ("read", "create", "write"),
    "admin": ("read", "write", "admin"),
    "create": ("read", "create"),
    "delete": ("read", "create", "write", "delete"),
    "invite": ("invite",),
    "org:integrations": ("read", "write", "admin"),
    "project:releases": ("read", "write", "admin"),
}


def get_permission_groups(scopes: Sequence[str]) -> list[OAuthPermissionGroup]:
    """Group consent display metadata without changing the requested token scopes."""
    pending = set(scopes)
    groups: list[OAuthPermissionGroup] = []
    for resource in _PERMISSION_RESOURCES:
        matched = [scope for scope in resource.scopes if scope in pending]
        if not matched:
            continue

        actions = list(
            dict.fromkeys(
                action
                for scope in matched
                for action in _PERMISSION_ACTIONS.get(
                    scope, _PERMISSION_ACTIONS.get(scope.partition(":")[2], ())
                )
            )
        )
        groups.append(
            {
                "resource": resource.resource,
                "label": resource.label,
                "scopes": matched,
                "actions": actions,
                "accessDescriptions": dict(resource.access_descriptions),
                "description": " ".join(get_permission_descriptions(matched))
                if not actions or resource.resource == "seer"
                else None,
            }
        )
        pending.difference_update(matched)

    if pending:
        raise NotImplementedError(f"{pending} scopes did not have permission groups")

    return groups


def get_organization_options(
    application: ApiApplication, user_id: int
) -> list[RpcOrganizationMapping]:
    if not application.requires_org_level_access:
        return []

    return user_service.get_organizations(user_id=user_id, only_visible=True)


def resolve_organization(
    application: ApiApplication, user_id: int, selected_organization_id: str | None
) -> int | None:
    """Return the selected organization ID for organization-scoped applications.

    Require a selection, parse its integer ID, and check it against the user's
    currently visible organization memberships. User-scoped applications use
    no organization regardless of the supplied selection.
    """
    if not application.requires_org_level_access:
        return None

    if not selected_organization_id:
        raise InvalidOrganizationSelection(OrganizationSelectionError.REQUIRED)

    try:
        organization_id = int(selected_organization_id)
    except ValueError:
        raise InvalidOrganizationSelection(OrganizationSelectionError.INVALID)

    organizations = get_organization_options(application, user_id)
    if organization_id not in {org.id for org in organizations}:
        raise InvalidOrganizationSelection(OrganizationSelectionError.NOT_ACCESSIBLE)

    return organization_id


def has_existing_consent(application: ApiApplication, user_id: int, scopes: Sequence[str]) -> bool:
    # Organization-scoped consent requires an explicit selection on each request.
    if application.requires_org_level_access:
        return False

    try:
        authorization = ApiAuthorization.objects.get(application=application, user_id=user_id)
    except ApiAuthorization.DoesNotExist:
        return False

    return all(authorization.has_scope(scope) for scope in scopes)


def persist_authorization(
    application: ApiApplication,
    user_id: int,
    scopes: Sequence[str],
    organization_id: int | None,
) -> None:
    # Catch outside the savepoint so a conflicting insert doesn't prevent the update.
    try:
        with transaction.atomic(router.db_for_write(ApiAuthorization)):
            ApiAuthorization.objects.create(
                application=application,
                user_id=user_id,
                scope_list=list(scopes),
                organization_id=organization_id,
            )
    except IntegrityError:
        if not scopes:
            return

        with transaction.atomic(router.db_for_write(ApiAuthorization)):
            # Serialize scope merges so concurrent approvals retain each other's scopes.
            authorization = ApiAuthorization.objects.select_for_update().get(
                application=application, user_id=user_id, organization_id=organization_id
            )
            authorization.scope_list = list(dict.fromkeys([*authorization.scope_list, *scopes]))
            authorization.save(update_fields=["scope_list"])

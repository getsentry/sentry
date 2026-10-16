from collections.abc import Sequence
from enum import Enum
from typing import Literal

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

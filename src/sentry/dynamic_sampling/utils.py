from collections.abc import Sequence

from django.contrib.auth.models import AnonymousUser

from sentry import features
from sentry.constants import SAMPLING_MODE_DEFAULT
from sentry.dynamic_sampling.types import DynamicSamplingMode
from sentry.models.organization import Organization
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser

DYNAMIC_SAMPLING_FEATURE = "organizations:dynamic-sampling"


def has_dynamic_sampling(
    organization: Organization | None, actor: User | RpcUser | AnonymousUser | None = None
) -> bool:
    # If an organization can't be fetched, we will assume it has no dynamic sampling.
    return organization is not None and features.has(
        DYNAMIC_SAMPLING_FEATURE, organization, actor=actor
    )


def org_ids_with_dynamic_sampling(organizations: Sequence[Organization]) -> list[int]:
    """The batched form of has_dynamic_sampling, for callers that check many organizations
    at once. Returns the ids of those that have it, in the order they were given.

    Raises on an empty result, because the alternative is to silently treat every
    organization as if it had no dynamic sampling.
    """
    if not organizations:
        return []

    results = features.batch_has_for_organizations(DYNAMIC_SAMPLING_FEATURE, organizations)
    if not results:
        raise RuntimeError(f"Unable to evaluate {DYNAMIC_SAMPLING_FEATURE} for a batch of orgs")

    return [
        organization.id
        for organization in organizations
        if results.get(f"organization:{organization.id}", False)
    ]


def has_custom_dynamic_sampling(
    organization: Organization | None, actor: User | RpcUser | AnonymousUser | None = None
) -> bool:
    return organization is not None and features.has(
        "organizations:dynamic-sampling-custom", organization, actor=actor
    )


def is_project_mode_sampling(organization: Organization | None) -> bool:
    return (
        organization is not None
        and has_custom_dynamic_sampling(organization)
        and organization.get_option("sentry:sampling_mode", SAMPLING_MODE_DEFAULT)
        == DynamicSamplingMode.PROJECT
    )


def is_organization_mode_sampling(organization: Organization | None) -> bool:
    return (
        organization is not None
        and has_custom_dynamic_sampling(organization)
        and organization.get_option("sentry:sampling_mode", SAMPLING_MODE_DEFAULT)
        == DynamicSamplingMode.ORGANIZATION
    )

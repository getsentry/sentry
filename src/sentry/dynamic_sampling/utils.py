from django.contrib.auth.models import AnonymousUser

from sentry import features
from sentry.constants import SAMPLING_MODE_DEFAULT
from sentry.dynamic_sampling.types import DynamicSamplingMode
from sentry.models.organization import Organization
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser


def has_dynamic_sampling(
    organization: Organization | None, actor: User | RpcUser | AnonymousUser | None = None
) -> bool:
    # If an organization can't be fetched, we will assume it has no dynamic sampling.
    return organization is not None and features.has(
        "organizations:dynamic-sampling", organization, actor=actor
    )


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

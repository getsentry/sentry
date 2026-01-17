from datetime import datetime, timezone

from django.conf import settings

from sentry import features
from sentry.data_secrecy.cache import effective_grant_status_cache
from sentry.data_secrecy.service.service import data_access_grant_service
from sentry.data_secrecy.types import EffectiveGrantStatus, GrantCacheStatus
from sentry.models.organization import Organization
from sentry.organizations.services.organization import RpcOrganization, RpcUserOrganizationContext


def should_allow_superuser_access(
    organization_context: Organization | RpcUserOrganizationContext,
) -> bool:

    # If self hosted installation, allow superuser access
    if settings.SENTRY_SELF_HOSTED:
        return True

    organization: Organization | RpcOrganization
    if isinstance(organization_context, RpcUserOrganizationContext):
        organization = organization_context.organization
    else:
        organization = organization_context

    # If organization's prevent_superuser_access bitflag is False, allow superuser access
    if not organization.flags.prevent_superuser_access:
        return True

    # If organization does not have data-secrecy feature, allow superuser access
    if not features.has("organizations:data-secrecy", organization):
        return True

    # If organization has data-secrecy feature, but prevent_superuser_access is True, prevent superuser access
    return False


def should_allow_superuser_access_v2(
    organization_context: Organization | RpcUserOrganizationContext,
) -> bool:
    """
    Determines if a superuser session is allowed for the organization.

    :param organization_context: The organization context to check.
    :return: True if a superuser session is allowed for the organization, False otherwise.

    Note: This method is not currently used. It will be rolled out when rest of Data Secrecy V2 is ready.
    It is an in-place replacement for should_allow_superuser_access.
    """

    if settings.SENTRY_SELF_HOSTED:
        return True

    organization: Organization | RpcOrganization
    if isinstance(organization_context, RpcUserOrganizationContext):
        organization = organization_context.organization
    else:
        organization = organization_context

    # If organization does not have data-secrecy-v2 feature, allow superuser access
    if not features.has("organizations:data-secrecy-v2", organization):
        return True

    # If organization's prevent_superuser_access bitflag is False, allow superuser access
    if not organization.flags.prevent_superuser_access:
        return True

    # If there is an active grant, allow superuser access
    if data_access_grant_exists(organization.id):
        return True

    return False


def data_access_grant_exists(organization_id: int) -> bool:
    """
    Determines if a data access grant exists for an organization.
    Tries cache first, calculates and caches if needed.

    :param organization_id: The ID of the organization to check.
    :return: True if a data access grant exists for the organization, False otherwise.
    """
    cached_status = effective_grant_status_cache.get(organization_id)

    if cached_status.cache_status == GrantCacheStatus.VALID_WINDOW:
        return True

    if cached_status.cache_status == GrantCacheStatus.NEGATIVE_CACHE:
        return False

    if cached_status.cache_status == GrantCacheStatus.EXPIRED_WINDOW:
        effective_grant_status_cache.delete(organization_id)

    # We have a cache miss or the entry is expired
    effective_grant_status = cache_effective_grant_status(organization_id)

    return effective_grant_status.cache_status == GrantCacheStatus.VALID_WINDOW


def cache_effective_grant_status(organization_id: int) -> EffectiveGrantStatus:
    current_time = datetime.now(timezone.utc)

    # Calculate fresh grant status
    rpc_grant_status = data_access_grant_service.get_effective_grant_status(
        organization_id=organization_id
    )

    effective_grant_status = EffectiveGrantStatus.from_rpc_grant_status(
        rpc_grant_status, current_time
    )

    effective_grant_status_cache.set(organization_id, effective_grant_status, current_time)

    return effective_grant_status

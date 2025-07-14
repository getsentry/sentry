from datetime import datetime, timezone

from django.conf import settings
from django.core.cache import cache

from sentry import features
from sentry.data_secrecy.service.service import data_access_grant_service
from sentry.data_secrecy.types import CACHE_KEY_PATTERN, NEGATIVE_CACHE_TTL, NEGATIVE_CACHE_VALUE
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

    # If organization does not have data-secrecy feature, allow superuser access
    if not features.has("organizations:data-secrecy", organization):
        return True

    # If organization's prevent_superuser_access bitflag is False, allow superuser access
    if not organization.flags.prevent_superuser_access:
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


def _get_cached_grant_status(organization_id: int) -> bool | None:
    """
    Retrieve cached grant status for an organization.

    :param organization_id: The ID of the organization to get the cached grant status for.
    :return:
        - False if negative cache hit.
        - True if cached data is valid and not expired.
        - None if not cached.
    """
    cache_key = CACHE_KEY_PATTERN.format(organization_id=organization_id)
    cached_data = cache.get(cache_key)

    if cached_data:
        # Check if it's negative cache
        if cached_data == NEGATIVE_CACHE_VALUE:
            return False

        # Verify the cached data hasn't logically expired
        access_end = cached_data["access_end"]
        if access_end > datetime.now(timezone.utc):
            return True
        else:
            # Cached data is stale, remove it
            # TODO: (iamrajjoshi) Invalidate the cache in other regions as well.
            cache.delete(cache_key)

    return None


def data_access_grant_exists(organization_id: int) -> bool:
    """
    Determines if a data access grant exists for an organization.
    Tries cache first, calculates and caches if needed.

    :param organization_id: The ID of the organization to check.
    :return: True if a data access grant exists for the organization, False otherwise.
    """
    # Try cache first
    cached_status = _get_cached_grant_status(organization_id)
    if cached_status is not None:
        return cached_status

    # Cache miss or expired, calculate fresh
    grant_status = data_access_grant_service.get_effective_grant_status(
        organization_id=organization_id
    )

    if grant_status:
        # Cache the grant status for the duration of the grant
        # This is ok since we invalidate the cache when the grant is revoked, updated, etc.
        ttl_seconds = int((grant_status.access_end - datetime.now(timezone.utc)).total_seconds())

        serialized_grant_status = grant_status.dict()

        cache.set(
            CACHE_KEY_PATTERN.format(organization_id=organization_id),
            serialized_grant_status,
            timeout=ttl_seconds,
        )

        return True
    else:
        # Cache the negative result for 15 minutes
        cache.set(
            CACHE_KEY_PATTERN.format(organization_id=organization_id),
            NEGATIVE_CACHE_VALUE,
            timeout=NEGATIVE_CACHE_TTL,
        )

    return False

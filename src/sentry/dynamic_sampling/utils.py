from collections.abc import Sequence

from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import ObjectDoesNotExist

from sentry import features, quotas
from sentry.constants import SAMPLING_MODE_DEFAULT, TARGET_SAMPLE_RATE_DEFAULT
from sentry.dynamic_sampling.types import DynamicSamplingMode
from sentry.models.organization import Organization
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser

DYNAMIC_SAMPLING_FEATURE = "organizations:dynamic-sampling"
RATE_ROLLOVER_FEATURE = "organizations:dynamic-sampling-platform-rate-rollover"


def _has_dynamic_sampling_rate(organization: Organization) -> bool:
    try:
        return quotas.backend.get_blended_sample_rate(organization_id=organization.id) is not None
    except ObjectDoesNotExist:
        return False


def has_dynamic_sampling(
    organization: Organization | None, actor: User | RpcUser | AnonymousUser | None = None
) -> bool:
    # If an organization can't be fetched, we will assume it has no dynamic sampling.
    if organization is None:
        return False
    if features.has(RATE_ROLLOVER_FEATURE, organization, actor=actor):
        return _has_dynamic_sampling_rate(organization)
    return features.has(DYNAMIC_SAMPLING_FEATURE, organization, actor=actor)


def orgs_with_dynamic_sampling(organizations: Sequence[Organization]) -> list[int]:
    rollover = features.batch_has_for_organizations(RATE_ROLLOVER_FEATURE, organizations)
    if rollover is None:
        raise RuntimeError(f"Unable to evaluate {RATE_ROLLOVER_FEATURE} for a batch of orgs")

    rollover_orgs = [org for org in organizations if rollover.get(f"organization:{org.id}", False)]
    legacy_orgs = [
        org for org in organizations if not rollover.get(f"organization:{org.id}", False)
    ]

    # TODO: Replace per-organization rate lookups with a bulk rate check for rollover orgs.
    rollover_ids = {org.id for org in rollover_orgs if _has_dynamic_sampling_rate(org)}
    legacy = (
        features.batch_has_for_organizations(DYNAMIC_SAMPLING_FEATURE, legacy_orgs)
        if legacy_orgs
        else {}
    )
    if legacy is None:
        raise RuntimeError(f"Unable to evaluate {DYNAMIC_SAMPLING_FEATURE} for a batch of orgs")

    legacy_ids = {org.id for org in legacy_orgs if legacy.get(f"organization:{org.id}", False)}
    eligible_ids = rollover_ids | legacy_ids
    return [org.id for org in organizations if org.id in eligible_ids]


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


def get_org_sample_rate(
    org_id: int, default_sample_rate: float | None
) -> tuple[float | None, bool]:
    """
    Returns the organization sample rate for dynamic sampling and whether it was configured by
    the organization. With custom dynamic sampling this is the target_sample_rate organization
    option. Without it, or when the option is unset, the default is returned.
    """
    try:
        org = Organization.objects.get_from_cache(id=org_id)
    except Organization.DoesNotExist:
        org = None

    if org is None or not has_custom_dynamic_sampling(org):
        return default_sample_rate, False

    sample_rate = org.get_option("sentry:target_sample_rate")
    if sample_rate is not None:
        return float(sample_rate), True
    if default_sample_rate is not None:
        return default_sample_rate, False
    return TARGET_SAMPLE_RATE_DEFAULT, False

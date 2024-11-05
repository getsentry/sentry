from sentry import features
from sentry.constants import SAMPLING_MODE_DEFAULT
from sentry.dynamic_sampling.types import DynamicSamplingMode
from sentry.models.organization import Organization


def has_dynamic_sampling(organization: Organization | None) -> bool:
    # If an organization can't be fetched, we will assume it has no dynamic sampling.
    if organization is None:
        return False

    return features.has("organizations:dynamic-sampling", organization)


def has_custom_dynamic_sampling(organization: Organization | None, **kwargs) -> bool:
    return organization is not None and features.has(
        "organizations:dynamic-sampling-custom", organization, **kwargs
    )


def is_project_mode_sampling(organization: Organization | None) -> bool:
    return (
        organization is not None
        and has_custom_dynamic_sampling(organization)
        and organization.get_option("sentry:sampling_mode", SAMPLING_MODE_DEFAULT)
        == DynamicSamplingMode.PROJECT
    )

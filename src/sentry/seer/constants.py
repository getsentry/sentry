from __future__ import annotations

from typing import TYPE_CHECKING, Literal

from sentry.integrations.types import IntegrationProviderSlug

if TYPE_CHECKING:
    from sentry.models.organization import Organization

# Type for Seer-supported SCM provider strings
SeerSCMProvider = Literal[
    "integrations:github",
    "integrations:github_enterprise",
    "integrations:gitlab",
    "github",
    "github_enterprise",
    "gitlab",
]

# Supported repository providers for Seer features
SEER_SUPPORTED_SCM_PROVIDERS = [
    "integrations:github",
    "integrations:github_enterprise",
    IntegrationProviderSlug.GITHUB.value,
    IntegrationProviderSlug.GITHUB_ENTERPRISE.value,
]

SEER_GITLAB_SCM_PROVIDERS = [
    "integrations:gitlab",
    IntegrationProviderSlug.GITLAB.value,
]


def get_supported_scm_providers(organization: Organization | None = None) -> list[str]:
    from sentry import features

    providers = list(SEER_SUPPORTED_SCM_PROVIDERS)
    if organization is not None and features.has("organizations:seer-gitlab-support", organization):
        providers.extend(SEER_GITLAB_SCM_PROVIDERS)
    return providers

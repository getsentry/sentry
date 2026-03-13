from typing import Literal

from sentry.integrations.types import IntegrationProviderSlug

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
    "integrations:gitlab",
    IntegrationProviderSlug.GITHUB.value,
    IntegrationProviderSlug.GITHUB_ENTERPRISE.value,
    IntegrationProviderSlug.GITLAB.value,
]

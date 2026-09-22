from typing import Literal

from sentry.integrations.types import IntegrationProviderSlug

# Type for Seer-supported SCM provider strings
SeerSCMProvider = Literal[
    "integrations:github",
    "integrations:github_enterprise",
    "integrations:gitlab",
    "integrations:perforce",
    "github",
    "github_enterprise",
    "gitlab",
    "perforce",
]

# GitHub providers (bare and `integrations:`-prefixed); mirrors frontend `isGitHubProvider`.
SEER_GITHUB_SCM_PROVIDERS = [
    "integrations:github",
    "integrations:github_enterprise",
    IntegrationProviderSlug.GITHUB.value,
    IntegrationProviderSlug.GITHUB_ENTERPRISE.value,
]

SEER_SUPPORTED_SCM_PROVIDERS = [*SEER_GITHUB_SCM_PROVIDERS]

SEER_GITLAB_SCM_PROVIDERS = [
    "integrations:gitlab",
    IntegrationProviderSlug.GITLAB.value,
]

SEER_PERFORCE_SCM_PROVIDERS = [
    "integrations:perforce",
    IntegrationProviderSlug.PERFORCE.value,
]

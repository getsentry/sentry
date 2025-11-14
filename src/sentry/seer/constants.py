from typing import int
from sentry.integrations.types import IntegrationProviderSlug

# Supported repository providers for Seer features
SEER_SUPPORTED_SCM_PROVIDERS = [
    "integrations:github",
    "integrations:github_enterprise",
    IntegrationProviderSlug.GITHUB.value,
    IntegrationProviderSlug.GITHUB_ENTERPRISE.value,
]

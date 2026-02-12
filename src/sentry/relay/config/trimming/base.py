from typing import TypedDict

from sentry.models.organization import Organization
from sentry.utils.services import Service


class TrimmingConfig(TypedDict):
    maxSize: int


# This mirrors the TrimmingConfigs struct in Relay
# https://github.com/getsentry/relay/blob/73e5f9816b10c518b4451d46ebffa709f9f7e897/relay-dynamic-config/src/project.rs#L297-L301
class TrimmingConfigs(TypedDict, total=False):
    span: TrimmingConfig


class Trimming(Service):
    """
    Handles fetching per-data-category trimming configuration for organizations.
    """

    __all__ = ("get_trimming_configs",)

    def get_trimming_configs(self, organization: Organization, **kwargs) -> TrimmingConfigs:
        """
        Returns per-data-category trimming settings.
        """
        return {}

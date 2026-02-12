from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from sentry.models.organization import Organization
from sentry.utils.services import Service


@dataclass
class TrimmingConfig:
    max_size: int

    def to_object(self) -> Mapping[str, Any]:
        return {
            "maxSize": self.max_size,
        }


# This mirrors the TrimmingConfigs struct in Relay
# https://github.com/getsentry/relay/blob/73e5f9816b10c518b4451d46ebffa709f9f7e897/relay-dynamic-config/src/project.rs#L297-L301
@dataclass
class TrimmingConfigs:
    span: TrimmingConfig | None

    def is_empty(self) -> bool:
        return self.span is None

    def to_object(self) -> Mapping[str, Any]:
        out = {}

        if self.span is not None:
            out["span"] = self.span.to_object()

        return out


class Trimming(Service):
    """
    Handles fetching per-data-category trimming configuration for organizations.
    """

    def get_trimming_configs(self, organization: Organization, **kwargs) -> TrimmingConfigs:
        """
        Returns per-data-category trimming settings.
        """
        return TrimmingConfigs(span=None)

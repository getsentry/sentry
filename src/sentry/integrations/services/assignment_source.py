from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime
from typing import TYPE_CHECKING, Any

from django.utils import timezone

if TYPE_CHECKING:
    from sentry.integrations.models import Integration
    from sentry.integrations.services.integration import RpcIntegration


@dataclass(frozen=True)
class AssignmentSource:
    source_name: str
    integration_id: int
    queued: datetime = timezone.now()

    @classmethod
    def from_integration(cls, integration: Integration | RpcIntegration) -> AssignmentSource:
        return AssignmentSource(
            source_name=integration.name,
            integration_id=integration.id,
        )

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, input_dict: dict[str, Any]) -> AssignmentSource | None:
        try:
            return cls(**input_dict)
        except (ValueError, TypeError):
            return None

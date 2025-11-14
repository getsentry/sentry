from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime
from typing import TYPE_CHECKING, Any, int

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
        payload = asdict(self)
        payload["queued"] = payload["queued"].isoformat()
        return payload

    @classmethod
    def from_dict(cls, input_dict: dict[str, Any]) -> AssignmentSource | None:
        try:
            if "queued" in input_dict and isinstance(input_dict["queued"], str):
                input_dict["queued"] = datetime.fromisoformat(input_dict["queued"])
            return cls(**input_dict)
        except (ValueError, TypeError):
            return None

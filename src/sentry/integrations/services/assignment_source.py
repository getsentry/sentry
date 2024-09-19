from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from django.utils import timezone

from sentry.utils import json

if TYPE_CHECKING:
    from sentry.integrations.models import Integration
    from sentry.integrations.services.integration import RpcIntegration


class AssignmentSourceType(str, Enum):
    integration = "integration"


@dataclass(frozen=True)
class AssignmentSource:
    source_type: AssignmentSourceType
    source_name: str
    integration_id: int
    queued: datetime = timezone.now()

    @classmethod
    def from_integration(cls, integration: Integration | RpcIntegration) -> AssignmentSource:
        return AssignmentSource(
            source_type=AssignmentSourceType.integration,
            source_name=integration.name,
            integration_id=integration.id,
        )

    def json(self) -> str:
        return json.dumps(asdict(self))

    @classmethod
    def from_json(cls, json_data: str) -> AssignmentSource | None:
        try:
            return cls(**json.loads(json_data))
        except ValueError:
            return None

"""Registry for Seer feature result delivery handlers."""

from __future__ import annotations

from typing import Any, Protocol
from uuid import UUID

from sentry.seer.agent.types import FeatureRunStatus
from sentry.seer.night_shift.delivery import deliver_night_shift_result
from sentry.seer.smart_assignment.delivery import deliver_smart_assignment_result

__all__ = ["DELIVERY_HANDLERS", "FeatureDeliveryFn", "FeatureRunStatus"]


class FeatureDeliveryFn(Protocol):
    def __call__(
        self,
        organization_id: int,
        run_uuid: UUID,
        status: FeatureRunStatus,
        result: dict[str, Any] | None,
        error: str | None,
    ) -> None: ...


DELIVERY_HANDLERS: dict[str, FeatureDeliveryFn] = {
    "night_shift": deliver_night_shift_result,
    "smart_assignment": deliver_smart_assignment_result,
}

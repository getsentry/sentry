"""Registry for Seer feature result delivery handlers."""

from __future__ import annotations

from typing import Any, Literal, Protocol

from sentry.seer.night_shift.delivery import deliver_night_shift_result

FeatureRunStatus = Literal["completed", "error"]


class FeatureDeliveryFn(Protocol):
    def __call__(
        self,
        organization_id: int,
        run_uuid: str,
        status: FeatureRunStatus,
        result: dict[str, Any] | None,
        error: str | None,
    ) -> None: ...


DELIVERY_HANDLERS: dict[str, FeatureDeliveryFn] = {
    "night_shift": deliver_night_shift_result,
}

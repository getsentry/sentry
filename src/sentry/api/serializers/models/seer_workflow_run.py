from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any, TypedDict

from sentry.api.serializers import Serializer, register
from sentry.api.serializers.models.seer_night_shift_run import (
    SeerNightShiftRunDetails,
    SeerNightShiftRunSerializer,
)
from sentry.seer.models.workflow import SeerWorkflowRun, SeerWorkflowStrategy


class SeerWorkflowRunResponse(TypedDict):
    id: str
    strategy: str
    status: str | None
    dateAdded: datetime
    dateCompleted: datetime | None
    extras: dict[str, Any]


class SeerNightShiftWorkflowRunResponse(SeerWorkflowRunResponse, SeerNightShiftRunDetails):
    pass


@register(SeerWorkflowRun)
class SeerWorkflowRunSerializer(Serializer[SeerWorkflowRunResponse]):
    def get_attrs(
        self, item_list: Sequence[SeerWorkflowRun], user: Any, **kwargs: Any
    ) -> dict[SeerWorkflowRun, dict[str, Any]]:
        triage_runs = [
            run for run in item_list if run.strategy == SeerWorkflowStrategy.AGENTIC_TRIAGE
        ]
        return SeerNightShiftRunSerializer().get_attrs(triage_runs, user, **kwargs)

    def serialize(
        self, obj: SeerWorkflowRun, attrs: Mapping[str, Any], user: Any, **kwargs: Any
    ) -> SeerWorkflowRunResponse:
        common: SeerWorkflowRunResponse = {
            "id": str(obj.id),
            "strategy": obj.strategy,
            "status": obj.status,
            "dateAdded": obj.date_added,
            "dateCompleted": obj.date_completed if obj.status is not None else obj.date_dispatched,
            "extras": obj.extras,
        }
        if obj.strategy == SeerWorkflowStrategy.AGENTIC_TRIAGE:
            response: SeerNightShiftWorkflowRunResponse = {
                **common,
                **SeerNightShiftRunSerializer().serialize(obj, attrs, user, **kwargs),
            }
            return response
        return common

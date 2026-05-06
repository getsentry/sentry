from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any, TypedDict

from django.db.models import prefetch_related_objects

from sentry.api.serializers import Serializer, register
from sentry.seer.models.night_shift import (
    NightShiftRunResultKind,
    SeerNightShiftRun,
    SeerNightShiftRunResult,
)


class SeerNightShiftRunResultResponse(TypedDict):
    id: str
    kind: str
    groupId: str | None
    seerRunId: str | None
    extras: dict[str, Any]
    dateAdded: str


# Legacy alias for the frontend; drop once it migrates to `results`.
class SeerNightShiftRunIssueResponse(TypedDict):
    id: str
    groupId: str
    action: str | None
    seerRunId: str | None
    dateAdded: str


class SeerNightShiftRunResponse(TypedDict):
    id: str
    dateAdded: str
    extras: dict[str, Any]
    errorMessage: str | None
    results: list[SeerNightShiftRunResultResponse]
    issues: list[SeerNightShiftRunIssueResponse]
    triageStrategy: str


@register(SeerNightShiftRun)
class SeerNightShiftRunSerializer(Serializer):
    def get_attrs(
        self, item_list: Sequence[SeerNightShiftRun], user: Any, **kwargs: Any
    ) -> dict[SeerNightShiftRun, dict[str, Any]]:
        prefetch_related_objects(item_list, "results")
        return {}

    def serialize(
        self,
        obj: SeerNightShiftRun,
        attrs: Mapping[str, Any],
        user: Any,
        **kwargs: Any,
    ) -> SeerNightShiftRunResponse:
        all_results = list(obj.results.all())
        triage_results = [
            r for r in all_results if r.kind == NightShiftRunResultKind.AGENTIC_TRIAGE
        ]
        extras = obj.extras or {}
        return {
            "id": str(obj.id),
            "dateAdded": obj.date_added.isoformat(),
            "extras": extras,
            # Legacy alias: error_message lives in extras now.
            "errorMessage": extras.get("error_message"),
            "results": [_serialize_result(r) for r in all_results],
            "issues": [_serialize_legacy_issue(r) for r in triage_results],
            # Match the pre-migration column behavior: always "agentic_triage"
            # in this PR. The multi-kind feature PR will refine this once
            # other kinds can produce runs.
            "triageStrategy": NightShiftRunResultKind.AGENTIC_TRIAGE.value,
        }


def _serialize_result(result: SeerNightShiftRunResult) -> SeerNightShiftRunResultResponse:
    return {
        "id": str(result.id),
        "kind": result.kind,
        "groupId": str(result.group_id) if result.group_id is not None else None,
        "seerRunId": result.seer_run_id,
        "extras": result.extras or {},
        "dateAdded": result.date_added.isoformat(),
    }


def _serialize_legacy_issue(result: SeerNightShiftRunResult) -> SeerNightShiftRunIssueResponse:
    extras = result.extras or {}
    return {
        "id": str(result.id),
        "groupId": str(result.group_id) if result.group_id is not None else "",
        "action": extras.get("action"),
        "seerRunId": result.seer_run_id,
        "dateAdded": result.date_added.isoformat(),
    }

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any, TypedDict

from django.db.models import Prefetch, prefetch_related_objects

from sentry.api.serializers import Serializer, register, serialize
from sentry.seer.models.night_shift import (
    SeerNightShiftRun,
    SeerNightShiftRunResult,
    SeerNightShiftRunShard,
)
from sentry.seer.models.workflow import SeerWorkflowStrategy


class SeerNightShiftRunResultResponse(TypedDict):
    id: str
    kind: str
    groupId: str | None
    seerRunId: str | None
    extras: dict[str, Any]
    dateAdded: str


# TODO(telkins): legacy alias for the frontend. Drop this, the `issues` key, and
# `_serialize_legacy_issue` once the UI reads `results` instead (filtering to
# kind=agentic_triage). The frontend migration must deploy before the removal.
class SeerNightShiftRunIssueResponse(TypedDict):
    id: str
    groupId: str
    action: str | None
    seerRunId: str | None
    dateAdded: str


class SeerNightShiftSeerRunResponse(TypedDict):
    seerRunId: str | None


class SeerNightShiftShardSerializer(Serializer[SeerNightShiftSeerRunResponse]):
    def serialize(
        self, obj: SeerNightShiftRunShard, attrs: Mapping[str, Any], user: Any, **kwargs: Any
    ) -> SeerNightShiftSeerRunResponse:
        state_id = obj.seer_run.seer_run_state_id if obj.seer_run is not None else None
        return {"seerRunId": str(state_id) if state_id is not None else None}


class SeerNightShiftRunResponse(TypedDict):
    id: str
    dateAdded: str
    extras: dict[str, Any]
    errorMessage: str | None
    results: list[SeerNightShiftRunResultResponse]
    issues: list[SeerNightShiftRunIssueResponse]
    seerRuns: list[SeerNightShiftSeerRunResponse]
    triageStrategy: str


@register(SeerNightShiftRun)
class SeerNightShiftRunSerializer(Serializer[SeerNightShiftRunResponse]):
    def get_attrs(
        self, item_list: Sequence[SeerNightShiftRun], user: Any, **kwargs: Any
    ) -> dict[SeerNightShiftRun, dict[str, Any]]:
        prefetch_related_objects(
            item_list,
            "results",
            Prefetch(
                "shards",
                queryset=SeerNightShiftRunShard.objects.order_by("id").select_related("seer_run"),
            ),
        )
        return {}

    def serialize(
        self,
        obj: SeerNightShiftRun,
        attrs: Mapping[str, Any],
        user: Any,
        **kwargs: Any,
    ) -> SeerNightShiftRunResponse:
        all_results = list(obj.results.all())
        triage_results = [r for r in all_results if r.kind == SeerWorkflowStrategy.AGENTIC_TRIAGE]
        extras = obj.extras or {}
        # A dispatch failure records on the run; per-shard delivery failures record
        # on the shard, so surface either so a failed shard doesn't read as healthy.
        shard_error = next(
            (
                s.extras["error_message"]
                for s in obj.shards.all()
                if (s.extras or {}).get("error_message")
            ),
            None,
        )
        return {
            "id": str(obj.id),
            "dateAdded": obj.date_added.isoformat(),
            "extras": extras,
            "errorMessage": extras.get("error_message") or shard_error,
            "results": [_serialize_result(r) for r in all_results],
            "issues": [_serialize_legacy_issue(r) for r in triage_results],
            "seerRuns": serialize(list(obj.shards.all()), user, SeerNightShiftShardSerializer()),
            # Match the pre-migration column behavior: always "agentic_triage"
            # in this PR. The multi-kind feature PR will refine this once
            # other kinds can produce runs.
            "triageStrategy": SeerWorkflowStrategy.AGENTIC_TRIAGE.value,
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

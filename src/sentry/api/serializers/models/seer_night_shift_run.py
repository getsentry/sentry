from __future__ import annotations

import re
from collections import defaultdict
from collections.abc import Mapping, Sequence
from typing import Any, TypedDict

from django.db.models import Prefetch, prefetch_related_objects

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.pullrequest import (
    PullRequestSerializer,
    PullRequestSerializerResponse,
)
from sentry.models.group import Group
from sentry.models.pullrequest import PullRequest
from sentry.seer.models.night_shift import (
    SeerNightShiftRun,
    SeerNightShiftRunErrorType,
    SeerNightShiftRunResult,
    SeerNightShiftRunShard,
)
from sentry.seer.models.run import SeerRunPullRequest
from sentry.seer.models.workflow import SeerWorkflowStrategy


class SeerNightShiftRunResultResponse(TypedDict):
    id: str
    kind: str
    groupId: str | None
    seerRunId: str | None
    extras: dict[str, Any]
    dateAdded: str


# TODO(telkins): this `issues` list is a triage-specific view derived from
# `results`, kept for the current frontend. Once the UI reads `results`
# directly (filtering to kind=agentic_triage), drop this key and _serialize_issue.
class SeerNightShiftRunIssueResponse(TypedDict):
    id: str
    groupId: str
    groupTitle: str | None
    groupShortId: str | None
    action: str | None
    reason: str | None
    skipReason: str | None
    seerRunId: str | None
    pullRequests: list[PullRequestSerializerResponse]
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
    errorType: SeerNightShiftRunErrorType | None
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

        triage_results = [
            r
            for run in item_list
            for r in run.results.all()
            if r.kind == SeerWorkflowStrategy.AGENTIC_TRIAGE
        ]

        group_ids = {r.group_id for r in triage_results if r.group_id is not None}
        # qualified_short_id needs group.project.slug, hence select_related.
        groups_by_id = Group.objects.filter(id__in=group_ids).select_related("project").in_bulk()
        group_titles_by_id: dict[int, str | None] = {
            group_id: group.title for group_id, group in groups_by_id.items()
        }
        group_short_ids_by_id: dict[int, str | None] = {
            group_id: group.qualified_short_id for group_id, group in groups_by_id.items()
        }

        seer_run_pk_by_result_id: dict[int, int] = {
            r.id: r.result_seer_run_id for r in triage_results if r.result_seer_run_id is not None
        }

        # Serialize each PR exactly once, keyed by Django pk (not `.key` --
        # that's the PR number and collides across repos).
        pr_ids_by_seer_run_pk: dict[int, list[int]] = defaultdict(list)
        pull_requests_by_pk: dict[int, PullRequest] = {}
        for link in SeerRunPullRequest.objects.filter(
            seer_run_id__in=set(seer_run_pk_by_result_id.values())
        ).select_related("pull_request"):
            pr_ids_by_seer_run_pk[link.seer_run_id].append(link.pull_request_id)
            pull_requests_by_pk[link.pull_request_id] = link.pull_request

        serialized_pr_by_pk: dict[int, PullRequestSerializerResponse] = {}
        if pull_requests_by_pk:
            prs = list(pull_requests_by_pk.values())
            serialized_pr_by_pk = {
                pr.id: serialized
                for pr, serialized in zip(prs, serialize(prs, user, PullRequestSerializer()))
            }

        pull_requests_by_result_id: dict[int, list[PullRequestSerializerResponse]] = {}
        for r in triage_results:
            seer_run_pk = seer_run_pk_by_result_id.get(r.id)
            pull_requests_by_result_id[r.id] = (
                [
                    serialized_pr_by_pk[pk]
                    for pk in pr_ids_by_seer_run_pk.get(seer_run_pk, [])
                    if pk in serialized_pr_by_pk
                ]
                if seer_run_pk is not None
                else []
            )

        shared = {
            "group_titles_by_id": group_titles_by_id,
            "group_short_ids_by_id": group_short_ids_by_id,
            "pull_requests_by_result_id": pull_requests_by_result_id,
        }
        return {run: shared for run in item_list}

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
        error_details: Mapping[str, Any] = extras
        if not error_details.get("error_message") and not error_details.get("error_type"):
            error_details = next(
                (
                    s.extras
                    for s in obj.shards.all()
                    if (s.extras or {}).get("error_message") or (s.extras or {}).get("error_type")
                ),
                {},
            )
        error_message: str | None = error_details.get("error_message")
        raw_error_type: str | None = error_details.get("error_type")
        error_type = _resolve_error_type(raw_error_type, error_message)
        group_titles_by_id = attrs.get("group_titles_by_id", {})
        group_short_ids_by_id = attrs.get("group_short_ids_by_id", {})
        pull_requests_by_result_id = attrs.get("pull_requests_by_result_id", {})
        return {
            "id": str(obj.id),
            "dateAdded": obj.date_added.isoformat(),
            "extras": extras,
            "errorMessage": error_message,
            "errorType": error_type,
            "results": [_serialize_result(r) for r in all_results],
            "issues": [
                _serialize_issue(
                    r, group_titles_by_id, group_short_ids_by_id, pull_requests_by_result_id
                )
                for r in triage_results
            ],
            "seerRuns": serialize(list(obj.shards.all()), user, SeerNightShiftShardSerializer()),
            # Match the pre-migration column behavior: always "agentic_triage"
            # in this PR. The multi-kind feature PR will refine this once
            # other kinds can produce runs.
            "triageStrategy": SeerWorkflowStrategy.AGENTIC_TRIAGE.value,
        }


_LEGACY_ERROR_TYPES = {
    "No Seer quota available": SeerNightShiftRunErrorType.NO_QUOTA,
    "Failed to get eligible projects": SeerNightShiftRunErrorType.ELIGIBLE_PROJECTS_FAILED,
    "Organization does not have Seer access": SeerNightShiftRunErrorType.NO_SEER_ACCESS,
    "Invalid Night Shift shard plan": SeerNightShiftRunErrorType.INVALID_SHARD_PLAN,
}
_ERROR_TYPES_BY_VALUE = {error_type.value: error_type for error_type in SeerNightShiftRunErrorType}


def _resolve_error_type(
    raw_error_type: str | None, error_message: str | None
) -> SeerNightShiftRunErrorType | None:
    if raw_error_type is not None:
        return _ERROR_TYPES_BY_VALUE.get(raw_error_type, SeerNightShiftRunErrorType.UNKNOWN)

    if error_message is None:
        return None
    if error_type := _LEGACY_ERROR_TYPES.get(error_message):
        return error_type
    if re.fullmatch(r"Failed to dispatch \d+ of \d+ triage shards", error_message):
        return SeerNightShiftRunErrorType.SHARD_DISPATCH_FAILED
    return SeerNightShiftRunErrorType.UNKNOWN


def _serialize_result(result: SeerNightShiftRunResult) -> SeerNightShiftRunResultResponse:
    return {
        "id": str(result.id),
        "kind": result.kind,
        "groupId": str(result.group_id) if result.group_id is not None else None,
        "seerRunId": result.seer_run_id,
        "extras": result.extras or {},
        "dateAdded": result.date_added.isoformat(),
    }


def _serialize_issue(
    result: SeerNightShiftRunResult,
    group_titles_by_id: Mapping[int, str | None],
    group_short_ids_by_id: Mapping[int, str | None],
    pull_requests_by_result_id: Mapping[int, list[PullRequestSerializerResponse]],
) -> SeerNightShiftRunIssueResponse:
    extras = result.extras or {}
    return {
        "id": str(result.id),
        "groupId": str(result.group_id) if result.group_id is not None else "",
        "groupTitle": (
            group_titles_by_id.get(result.group_id) if result.group_id is not None else None
        ),
        "groupShortId": (
            group_short_ids_by_id.get(result.group_id) if result.group_id is not None else None
        ),
        "action": extras.get("action"),
        "reason": extras.get("reason"),
        "skipReason": extras.get("skip_reason"),
        "seerRunId": result.seer_run_id,
        "pullRequests": pull_requests_by_result_id.get(result.id, []),
        "dateAdded": result.date_added.isoformat(),
    }

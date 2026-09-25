from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.issues.derived.framework import DerivedDataError, Pipeline, State
from sentry.issues.derived.processing import PIPELINE
from sentry.issues.derived.store import GroupDerivedDataStore
from sentry.issues.endpoints.bases.group import GroupEndpoint
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.issues.models.groupderiveddata import GroupDerivedData
from sentry.models.group import Group

DEFAULT_LIMIT = 1000
MAX_LIMIT = 10000


def _state_to_dict(pipeline: Pipeline[Any], state: State) -> dict[str, Any]:
    return {f.name: f.to_json(state[f]) for f in pipeline.features}


def _error_to_dict(error: DerivedDataError) -> dict[str, Any]:
    return {
        "detail": str(error),
        "stage": error.stage,
        "feature": error.feature_name,
        "aggregator": error.aggregator_name,
        "entryId": str(error.entry_id) if error.entry_id is not None else None,
    }


@cell_silo_endpoint
class DebugGroupDerivedDataEndpoint(GroupEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, group: Group) -> Response:
        raw_limit = request.GET.get("limit", str(DEFAULT_LIMIT))
        try:
            limit = int(raw_limit)
        except ValueError:
            return Response({"detail": f"Invalid limit: {raw_limit!r}"}, status=400)
        if limit < 1:
            return Response({"detail": "limit must be at least 1"}, status=400)
        if limit > MAX_LIMIT:
            return Response({"detail": f"limit must be at most {MAX_LIMIT}"}, status=400)

        errors: dict[str, Any] = {}

        # --- Stored state ---
        try:
            derived = GroupDerivedData.objects.get(group_id=group.id)
        except GroupDerivedData.DoesNotExist:
            stored = None
        else:
            stored = {
                "state": None,
                "cursorDate": str(derived.cursor_date),
                "cursorId": derived.cursor_id,
                "generatedAt": str(derived.generated_at),
                "pipelineHash": derived.pipeline_hash,
            }
            try:
                stored["state"] = _state_to_dict(
                    PIPELINE, GroupDerivedDataStore.load(PIPELINE, derived)
                )
            except DerivedDataError as error:
                errors["stored"] = _error_to_dict(error)

        # --- Computed state ---
        entries = list(
            GroupActionLogEntry.objects.filter(group_id=group.id).order_by("date_added", "id")[
                : limit + 1
            ]
        )

        if len(entries) > limit:
            computed = None
            entry_count = None
            truncated = True
        else:
            try:
                state = PIPELINE.run(entries)
                computed = _state_to_dict(PIPELINE, state)
            except DerivedDataError as error:
                computed = None
                errors["computed"] = _error_to_dict(error)
            entry_count = len(entries)
            truncated = False

        return Response(
            {
                "groupId": str(group.id),
                "pipelineHash": PIPELINE.pipeline_hash,
                "stored": stored,
                "computed": computed,
                "entryCount": entry_count,
                "truncated": truncated,
                "limit": limit,
                "errors": errors,
            }
        )

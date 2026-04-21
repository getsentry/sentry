from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any, TypedDict

from django.db.models import prefetch_related_objects

from sentry.api.serializers import Serializer, register
from sentry.seer.models.night_shift import SeerNightShiftRun, SeerNightShiftRunIssue


class SeerNightShiftRunIssueResponse(TypedDict):
    id: str
    groupId: str
    action: str
    seerRunId: str | None
    dateAdded: str


class SeerNightShiftRunResponse(TypedDict):
    id: str
    dateAdded: str
    triageStrategy: str
    errorMessage: str | None
    extras: dict[str, Any]
    issues: list[SeerNightShiftRunIssueResponse]


@register(SeerNightShiftRun)
class SeerNightShiftRunSerializer(Serializer):
    def get_attrs(
        self, item_list: Sequence[SeerNightShiftRun], user: Any, **kwargs: Any
    ) -> dict[SeerNightShiftRun, dict[str, Any]]:
        prefetch_related_objects(item_list, "issues")
        return {}

    def serialize(
        self,
        obj: SeerNightShiftRun,
        attrs: Mapping[str, Any],
        user: Any,
        **kwargs: Any,
    ) -> SeerNightShiftRunResponse:
        return {
            "id": str(obj.id),
            "dateAdded": obj.date_added.isoformat(),
            "triageStrategy": obj.triage_strategy,
            "errorMessage": obj.error_message,
            "extras": obj.extras or {},
            "issues": [_serialize_issue(i) for i in obj.issues.all()],
        }


def _serialize_issue(issue: SeerNightShiftRunIssue) -> SeerNightShiftRunIssueResponse:
    return {
        "id": str(issue.id),
        "groupId": str(issue.group_id),
        "action": issue.action,
        "seerRunId": issue.seer_run_id,
        "dateAdded": issue.date_added.isoformat(),
    }

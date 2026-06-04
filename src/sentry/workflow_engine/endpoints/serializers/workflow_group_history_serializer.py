from collections.abc import Mapping, MutableMapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any, NotRequired, TypedDict, cast

from django.db.models import Count, Max, OuterRef, Subquery
from rest_framework.exceptions import ParseError

from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import Serializer, serialize
from sentry.api.serializers.models.group import BaseGroupSerializerResponse
from sentry.models.group import Group
from sentry.utils.cursors import Cursor, CursorResult
from sentry.workflow_engine.models import Detector, DetectorGroup, Workflow, WorkflowFireHistory


@dataclass(frozen=True)
class WorkflowGroupHistory:
    group: Group
    count: int
    last_triggered: datetime
    event_id: str
    detector: Detector | None


class WorkflowFireHistoryResponse(TypedDict):
    group: BaseGroupSerializerResponse
    count: int
    lastTriggered: datetime
    eventId: str
    detector: NotRequired[dict[str, Any]]


class _Result(TypedDict):
    group: int
    count: int
    last_triggered: datetime
    event_id: str
    group_detector_id: int | None


def convert_results(results: Sequence[_Result]) -> Sequence[WorkflowGroupHistory]:
    group_lookup = {g.id: g for g in Group.objects.filter(id__in=[r["group"] for r in results])}

    detector_ids = [r["group_detector_id"] for r in results if r["group_detector_id"] is not None]
    detector_lookup = {}
    if detector_ids:
        detector_lookup = {d.id: d for d in Detector.objects.filter(id__in=detector_ids)}

    return [
        WorkflowGroupHistory(
            group=group_lookup[r["group"]],
            count=r["count"],
            last_triggered=r["last_triggered"],
            event_id=r["event_id"],
            detector=(
                detector_lookup.get(r["group_detector_id"])
                if r["group_detector_id"] is not None
                else None
            ),
        )
        for r in results
    ]


class WorkflowGroupHistorySerializer(Serializer[WorkflowFireHistoryResponse]):
    def get_attrs(
        self, item_list: Sequence[WorkflowGroupHistory], user: Any, **kwargs: Any
    ) -> MutableMapping[Any, Any]:
        serialized_groups = {
            g["id"]: g for g in serialize([item.group for item in item_list], user)
        }

        # Get detectors that are not None
        detectors = [item.detector for item in item_list if item.detector is not None]
        serialized_detectors = {}
        if detectors:
            serialized_detectors = {
                str(d.id): serialized
                for d, serialized in zip(detectors, serialize(detectors, user))
            }

        attrs = {}
        for history in item_list:
            item_attrs = {"group": serialized_groups[str(history.group.id)]}
            if history.detector:
                item_attrs["detector"] = serialized_detectors[str(history.detector.id)]

            attrs[history] = item_attrs

        return attrs

    def serialize(
        self, obj: WorkflowGroupHistory, attrs: Mapping[Any, Any], user: Any, **kwargs: Any
    ) -> WorkflowFireHistoryResponse:
        result: WorkflowFireHistoryResponse = {
            "group": attrs["group"],
            "count": obj.count,
            "lastTriggered": obj.last_triggered,
            "eventId": obj.event_id,
        }

        if "detector" in attrs:
            result["detector"] = attrs["detector"]

        return result


_SORT_FIELD_MAP = {
    "lastTriggered": "last_triggered",
    "count": "count",
}
# `group` is appended as a stable tiebreaker so OffsetPaginator pages don't
# skip or duplicate rows when the user-provided sort fields tie.
_TIEBREAKER = "group"
_DEFAULT_ORDER_BY = ("-last_triggered", "-count", _TIEBREAKER)


def _parse_sort(sort: Sequence[str]) -> list[str]:
    if not sort:
        return list(_DEFAULT_ORDER_BY)

    order_by: list[str] = []
    for s in sort:
        if s.startswith("-"):
            prefix, field = "-", s[1:]
        else:
            prefix, field = "", s
        if field not in _SORT_FIELD_MAP:
            raise ParseError(detail=f"Invalid sort field: {field}")
        order_by.append(f"{prefix}{_SORT_FIELD_MAP[field]}")
    order_by.append(_TIEBREAKER)
    return order_by


def fetch_workflow_groups_paginated(
    workflow: Workflow,
    start: datetime,
    end: datetime,
    cursor: Cursor | None = None,
    per_page: int = 25,
    sort: Sequence[str] = (),
) -> CursorResult[WorkflowGroupHistory]:
    filtered_history = WorkflowFireHistory.objects.filter(
        workflow=workflow,
        date_added__gte=start,
        date_added__lt=end,
    )

    # subquery that retrieves row with the largest date in a group
    group_max_dates = filtered_history.filter(group=OuterRef("group")).order_by("-date_added")[:1]

    # Subquery to get the detector_id from DetectorGroup.
    # The detector does not currently need to be connected to the workflow.
    detector_subquery = DetectorGroup.objects.filter(
        group=OuterRef("group"),
    ).values("detector_id")[:1]

    qs = (
        filtered_history.select_related("group")
        .values("group")
        .annotate(count=Count("group"))
        .annotate(event_id=Subquery(group_max_dates.values("event_id")))
        .annotate(last_triggered=Max("date_added"))
        .annotate(group_detector_id=Subquery(detector_subquery))
    )

    # Count distinct groups for pagination
    group_count = qs.count()
    order_by = _parse_sort(sort)

    return cast(
        CursorResult[WorkflowGroupHistory],
        OffsetPaginator(
            qs,
            order_by=order_by,
            on_results=convert_results,
        ).get_result(per_page, cursor, known_hits=group_count),
    )

from collections.abc import Mapping, MutableMapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any, NotRequired, TypedDict, cast

from django.db.models import Count, Max, OuterRef, Subquery

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
    detector_id: int | None


def convert_results(results: Sequence[_Result]) -> Sequence[WorkflowGroupHistory]:
    group_lookup = {g.id: g for g in Group.objects.filter(id__in=[r["group"] for r in results])}

    detector_ids = [r["detector_id"] for r in results if r["detector_id"] is not None]
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
                detector_lookup.get(r["detector_id"]) if r["detector_id"] is not None else None
            ),
        )
        for r in results
    ]


class WorkflowGroupHistorySerializer(Serializer):
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


def fetch_workflow_groups_paginated(
    workflow: Workflow,
    start: datetime,
    end: datetime,
    cursor: Cursor | None = None,
    per_page: int = 25,
) -> CursorResult[Group]:
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
    ).values(
        "detector_id"
    )[:1]

    qs = (
        filtered_history.select_related("group")
        .values("group")
        .annotate(count=Count("group"))
        .annotate(event_id=Subquery(group_max_dates.values("event_id")))
        .annotate(last_triggered=Max("date_added"))
        .annotate(detector_id=Subquery(detector_subquery))
    )

    # Count distinct groups for pagination
    group_count = qs.count()

    return cast(
        CursorResult[Group],
        OffsetPaginator(
            qs,
            order_by=("-count", "-last_triggered"),
            on_results=convert_results,
        ).get_result(per_page, cursor, known_hits=group_count),
    )

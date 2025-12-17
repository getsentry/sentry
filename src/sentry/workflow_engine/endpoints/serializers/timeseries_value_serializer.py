from collections.abc import Mapping, Sequence
from datetime import datetime, timedelta, timezone
from typing import Any, TypedDict

from django.db.models import Count
from django.db.models.functions import TruncHour

from sentry.api.serializers import Serializer
from sentry.rules.history.base import TimeSeriesValue
from sentry.workflow_engine.models import Workflow, WorkflowFireHistory


class TimeSeriesValueResponse(TypedDict):
    date: datetime
    count: int


class TimeSeriesValueSerializer(Serializer):
    def serialize(
        self, obj: TimeSeriesValue, attrs: Mapping[Any, Any], user: Any, **kwargs: Any
    ) -> TimeSeriesValueResponse:
        return {
            "date": obj.bucket,
            "count": obj.count,
        }


def fetch_workflow_hourly_stats(
    workflow: Workflow, start: datetime, end: datetime
) -> Sequence[TimeSeriesValue]:
    start = start.replace(tzinfo=timezone.utc)
    end = end.replace(tzinfo=timezone.utc)
    qs = (
        WorkflowFireHistory.objects.filter(
            workflow=workflow,
            date_added__gte=start,
            date_added__lt=end,
        )
        .annotate(bucket=TruncHour("date_added"))
        .order_by("bucket")
        .values("bucket")
        .annotate(count=Count("id"))
    )
    existing_data = {row["bucket"]: TimeSeriesValue(row["bucket"], row["count"]) for row in qs}

    results = []
    current = start.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    while current <= end.replace(minute=0, second=0, microsecond=0):
        results.append(existing_data.get(current, TimeSeriesValue(current, 0)))
        current += timedelta(hours=1)
    return results

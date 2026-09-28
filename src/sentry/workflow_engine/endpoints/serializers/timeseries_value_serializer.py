from collections.abc import Sequence
from datetime import datetime, timedelta, timezone

from django.db.models import Count
from django.db.models.functions import TruncHour

from sentry.api.endpoints.timeseries import Row, SeriesMeta, StatsMeta, StatsResponse, TimeSeries
from sentry.rules.history.base import TimeSeriesValue
from sentry.workflow_engine.models import Workflow, WorkflowFireHistory

HOUR_IN_MILLISECONDS = 60 * 60 * 1000


def serialize_workflow_stats(
    results: Sequence[TimeSeriesValue], start: datetime, end: datetime
) -> StatsResponse:
    return StatsResponse(
        meta=StatsMeta(
            dataset="workflow",
            start=start.timestamp() * 1000,
            end=end.timestamp() * 1000,
        ),
        timeSeries=[
            TimeSeries(
                yAxis="count()",
                values=[
                    Row(
                        timestamp=result.bucket.timestamp() * 1000,
                        value=result.count,
                        incomplete=False,
                    )
                    for result in results
                ],
                meta=SeriesMeta(
                    interval=HOUR_IN_MILLISECONDS,
                    valueType="integer",
                    valueUnit=None,
                ),
            )
        ],
    )


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

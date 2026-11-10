from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from sentry.seer.anomaly_detection.types import AnomalyThresholdDataPoint
from sentry.web.frontend.debug.charts.metric_detector_open_periods import AnomalyBand, OpenPeriod
from sentry.web.frontend.debug.charts.metric_detector_series import TimeseriesPoint


@dataclass(frozen=True)
class MetricQuery:
    name: str
    aggregate: str
    time_window: int
    dataset: str = "events"
    event_types: Sequence[str] = ("error",)


def build_span_query(name: str, aggregate: str, time_window: int) -> MetricQuery:
    return MetricQuery(
        name=name,
        aggregate=aggregate,
        time_window=time_window,
        dataset="events_analytics_platform",
        event_types=("trace_item_span",),
    )


def build_data_source_payload(detector_id: int, query: MetricQuery) -> dict[str, Any]:
    return {
        "id": str(detector_id),
        "organizationId": "1",
        "type": "snuba_query_subscription",
        "sourceId": str(detector_id),
        "queryObj": {
            "id": str(detector_id),
            "status": 0,
            "subscription": f"1/{detector_id}",
            "snubaQuery": {
                "id": str(detector_id),
                "dataset": query.dataset,
                "query": "",
                "aggregate": query.aggregate,
                "timeWindow": query.time_window,
                "environment": None,
                "eventTypes": list(query.event_types),
            },
        },
    }


def build_detector_payload(
    detector_id: int,
    query: MetricQuery,
    condition_payloads: Sequence[dict[str, Any]],
    config: dict[str, Any],
) -> dict[str, Any]:
    conditions = [
        {"id": str(detector_id * 10 + index), **condition}
        for index, condition in enumerate(condition_payloads)
    ]

    return {
        "id": str(detector_id),
        "projectId": "1",
        "name": query.name,
        "type": "metric_issue",
        "workflowIds": [],
        "owner": None,
        "createdBy": None,
        "dateCreated": "2026-01-05T17:00:00Z",
        "dateUpdated": "2026-01-05T17:00:00Z",
        "dataSources": [build_data_source_payload(detector_id, query)],
        "conditionGroup": {
            "id": str(detector_id),
            "organizationId": "1",
            "logicType": "any",
            "conditions": conditions,
            "actions": [],
        },
        "config": config,
        "enabled": True,
        "alertRuleId": None,
        "ruleId": None,
        "latestGroup": None,
        "openIssues": 0,
    }


def build_anomaly_threshold_payloads(
    band: AnomalyBand, values: Sequence[float], bucket_starts_ms: Sequence[int], alert_id: int
) -> list[AnomalyThresholdDataPoint]:
    return [
        {
            "external_alert_id": alert_id,
            "timestamp": bucket_start_ms / 1000,
            "value": value,
            "yhat_lower": expected_value - band.tolerance,
            "yhat_upper": expected_value + band.tolerance,
        }
        for bucket_start_ms, value, expected_value in zip(
            bucket_starts_ms, values, band.expected_values
        )
    ]


def build_chart_data_payload(
    *,
    detector: dict[str, Any],
    aggregate: str,
    points: Sequence[TimeseriesPoint],
    open_periods: Sequence[OpenPeriod],
    comparison_points: Sequence[TimeseriesPoint],
    anomaly_thresholds: Sequence[AnomalyThresholdDataPoint],
) -> dict[str, Any]:
    """
    The payload the notification sends Chartcuterie. Percent change monitors add the
    comparison series and anomaly detection monitors add Seer's expected range.
    """
    payload: dict[str, Any] = {
        "detector": detector,
        "timeseriesData": [{"seriesName": aggregate, "data": list(points)}],
        "openPeriods": list(open_periods),
    }

    if comparison_points:
        payload["comparisonTimeseriesData"] = [
            {"seriesName": aggregate, "data": list(comparison_points)}
        ]

    if anomaly_thresholds:
        payload["anomalyThresholds"] = list(anomaly_thresholds)

    return payload

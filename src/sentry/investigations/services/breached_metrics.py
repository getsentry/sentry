from __future__ import annotations

import hashlib
from collections.abc import Set as AbstractSet
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Iterable

from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.models.group import Group, GroupStatus
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.models.organization import Organization
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscription, SnubaQueryEventType
from sentry.workflow_engine.models import DataSourceDetector, DetectorGroup
from sentry.workflow_engine.models.data_condition import Condition

MAX_BREACH_WINDOW = timedelta(days=45)


@dataclass(frozen=True)
class BreachedMetricSource:
    group: Group
    open_period: GroupOpenPeriod
    project_id: int
    project_slug: str
    source_key: str
    dataset: str
    snapshot: dict[str, Any]


def _code_mode_dataset(
    dataset: Dataset, event_types: list[SnubaQueryEventType.EventType]
) -> str | None:
    if dataset == Dataset.Events:
        return "errors"
    if dataset == Dataset.IssuePlatform:
        return "issues"
    if dataset == Dataset.SpansIndexed:
        return "spans"
    if dataset != Dataset.EventsAnalyticsPlatform or len(event_types) != 1:
        return None
    return {
        SnubaQueryEventType.EventType.ERROR: "errors",
        SnubaQueryEventType.EventType.TRACE_ITEM_SPAN: "spans",
        SnubaQueryEventType.EventType.TRACE_ITEM_LOG: "logs",
        SnubaQueryEventType.EventType.TRACE_ITEM_METRIC: "metrics",
    }.get(event_types[0])


def _source_key(group_id: int, open_period_id: int) -> str:
    value = f"breached_metric:{group_id}:{open_period_id}"
    return hashlib.sha256(value.encode()).hexdigest()


def _direction(conditions: list[dict[str, Any]]) -> str:
    condition_types = {condition["type"] for condition in conditions}
    if condition_types & {Condition.GREATER, Condition.GREATER_OR_EQUAL}:
        return "above"
    if condition_types & {Condition.LESS, Condition.LESS_OR_EQUAL}:
        return "below"
    return "comparison"


def _analysis_window(open_period: GroupOpenPeriod, now: datetime) -> dict[str, str]:
    breach_start = max(open_period.date_started, now - MAX_BREACH_WINDOW)
    baseline_start = breach_start - (now - breach_start)
    return {
        "baselineStart": baseline_start.isoformat(),
        "breachStart": breach_start.isoformat(),
        "end": now.isoformat(),
    }


def resolve_breached_metric_sources(
    *,
    organization: Organization,
    group_ids: Iterable[int],
    accessible_project_ids: AbstractSet[int],
    now: datetime | None = None,
) -> dict[int, BreachedMetricSource]:
    """Resolve supported current metric breaches in bulk.

    Missing entries are deliberately unavailable. The caller should not reveal
    whether an inaccessible or invalid issue exists.
    """
    unique_group_ids = set(group_ids)
    if not unique_group_ids:
        return {}

    groups = {
        group.id: group
        for group in Group.objects.filter(
            id__in=unique_group_ids,
            project__organization=organization,
            project_id__in=accessible_project_ids,
            type=MetricIssue.type_id,
            status=GroupStatus.UNRESOLVED,
        ).select_related("project")
    }
    open_periods = {
        period.group_id: period
        for period in GroupOpenPeriod.objects.filter(
            group_id__in=groups, date_ended__isnull=True
        ).select_related("group")
    }
    detector_groups = {
        link.group_id: link
        for link in DetectorGroup.objects.filter(
            group_id__in=groups,
            detector__isnull=False,
            detector__status=ObjectStatus.ACTIVE,
        )
        .select_related("detector", "detector__workflow_condition_group")
        .prefetch_related("detector__workflow_condition_group__conditions")
    }
    data_source_links = {
        link.detector_id: link
        for link in DataSourceDetector.objects.filter(
            detector_id__in=[link.detector_id for link in detector_groups.values()],
            data_source__type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        ).select_related("data_source")
    }
    subscription_ids: set[int] = set()
    for link in data_source_links.values():
        try:
            subscription_ids.add(int(link.data_source.source_id))
        except (TypeError, ValueError):
            continue
    subscriptions = {
        subscription.id: subscription
        for subscription in QuerySubscription.objects.filter(id__in=subscription_ids)
        .select_related("project", "snuba_query", "snuba_query__environment")
        .prefetch_related("snuba_query__snubaqueryeventtype_set")
    }

    resolved: dict[int, BreachedMetricSource] = {}
    current_time = now or timezone.now()
    for group_id, group in groups.items():
        open_period = open_periods.get(group_id)
        detector_group = detector_groups.get(group_id)
        if open_period is None or detector_group is None or detector_group.detector is None:
            continue
        detector = detector_group.detector
        if (
            detector.type != "metric_issue"
            or detector.project_id != group.project_id
            or detector.config.get("detection_type") != AlertRuleDetectionType.STATIC
        ):
            continue
        data_source_link = data_source_links.get(detector.id)
        if data_source_link is None:
            continue
        try:
            subscription_id = int(data_source_link.data_source.source_id)
        except (TypeError, ValueError):
            continue
        subscription = subscriptions.get(subscription_id)
        if subscription is None or subscription.project_id != group.project_id:
            continue
        snuba_query = subscription.snuba_query
        try:
            dataset = Dataset(snuba_query.dataset)
        except ValueError:
            continue
        code_mode_dataset = _code_mode_dataset(dataset, snuba_query.event_types)
        if code_mode_dataset is None:
            continue
        condition_group = detector.workflow_condition_group
        if condition_group is None:
            continue
        conditions = [
            {
                "type": condition.type,
                "comparison": condition.comparison,
                "result": condition.condition_result,
            }
            for condition in condition_group.conditions.all()
        ]
        if not conditions:
            continue
        snapshot = {
            "groupId": str(group.id),
            "groupTitle": group.title,
            "openPeriodId": str(open_period.id),
            "monitor": {
                "id": str(detector.id),
                "name": detector.name,
                "dataset": code_mode_dataset,
                "query": snuba_query.query,
                "aggregate": snuba_query.aggregate,
                "groupBy": snuba_query.group_by or [],
                "timeWindowSeconds": snuba_query.time_window,
                "comparisonDeltaSeconds": detector.config.get("comparison_delta"),
                "direction": _direction(conditions),
                "conditions": conditions,
                "environment": (
                    snuba_query.environment.name if snuba_query.environment is not None else None
                ),
            },
            "project": {"id": str(group.project_id), "slug": group.project.slug},
            "analysisWindow": _analysis_window(open_period, current_time),
        }
        resolved[group_id] = BreachedMetricSource(
            group=group,
            open_period=open_period,
            project_id=group.project_id,
            project_slug=group.project.slug,
            source_key=_source_key(group.id, open_period.id),
            dataset=code_mode_dataset,
            snapshot=snapshot,
        )
    return resolved

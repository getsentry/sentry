"""This module has the logic for calculating the velocity threshold based on the 90th percentile
of events per issue per hour, which is then stored per project in Redis.
"""

import datetime
import logging

from snuba_sdk import (  # Limit,
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Limit,
    Op,
    OrderBy,
    Query,
    Request,
)

from sentry.models.project import Project
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)

REFERRER = "sentry.issues.issue_velocity"


def calculate_velocity_threshold_for_project(project: Project) -> int | None:
    now = datetime.now()
    one_week_ago = now - datetime.timedelta(days=7)
    ninety_days_ago = now - datetime.timedelta(days=90)

    """ @ wednesday isabella this is it i'm pretty sure
    MATCH (search_issues)
    SELECT group_id, min(timestamp) AS first_seen, countIf(greaterOrEquals(timestamp, one_week_ago)) AS num_events_for_issue_in_past_week, if(less(first_seen, one_week_ago), divide(num_events_for_issue_in_past_week, 7*24), divide(num_events_for_issue_in_past_week, dateDiff('hour', first_seen, now))) AS events_per_issue_per_hour
    BY group_id
    WHERE timestamp >= 90_days_ago
        AND timestamp < now
    AND project_id = project.id
    HAVING num_events_for_issue_in_past_week > 1 ORDER BY first_seen DESC

    """
    subquery = Query(
        match=Entity(EntityKey.IssuePlatform.value),
        select=[
            Column("group_id"),
            Function("min", [Column("timestamp")], "first_seen"),
            Function(
                "countIf",
                [Function("greaterOrEquals", [Column("timestamp"), one_week_ago])],
                "num_events_for_issue_in_past_week",
            ),
            Function(
                "if",
                [
                    Function("less", [Column("first_seen"), one_week_ago]),
                    Function("divide", [Column("num_events_for_issues_in_past_week"), 168]),
                    Function("divide"),
                    [
                        Column("num_events_for_issues_in_past_week"),
                        Function("dateDiff", ["hour", Column("first_seen"), now]),
                    ],
                    "events_per_issue_per_hour",
                ],
            ),
        ],
        groupby=[Column("group_id")],
        where=[
            Condition(Column("timestamp"), Op.GTE, ninety_days_ago),
            Condition(Column("timestamp"), Op.LT, now),
            Condition(Column("project_id"), Op.EQ, project.id),
        ],
        having=[Condition(Column("num_events_for_issues_in_past_week"), Op.GT, 1)],
        orderby=[OrderBy(Column("first_seen"), Direction.ASC)],
        limit=Limit(10000),
    )

    query = Query(
        match=subquery,
        select=[Function("quantile(0.9)", Column("events_per_issue_per_hour"), "p90")],
        limit=Limit(1),
    )

    request = Request(
        dataset=Dataset.PerformanceMetrics.value,
        app_id=REFERRER,
        query=query,
        tenant_ids={"referrer": REFERRER, "organization_id": project.organization.id},
    )

    hourly_event_counts_per_issue = raw_snql_query(request, referrer=REFERRER)["data"]
    if len(hourly_event_counts_per_issue) == 0:
        return None

    num_issues = len(hourly_event_counts_per_issue)
    last_element_in_percentile = hourly_event_counts_per_issue[int(num_issues * 0.05)]

    return last_element_in_percentile["event_count"]


def set_velocity_threshold_for_project(project: Project) -> None:
    threshold = calculate_velocity_threshold_for_project(project)
    if threshold is None:
        logger.error("Velocity threshold couldn't be calculated", extra={"project_id": project.id})
        return
    # store in redis


def get_velocity_threshold_for_project(project: Project) -> int:
    # get from redis
    pass

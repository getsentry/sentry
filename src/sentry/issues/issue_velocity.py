"""This module has the logic for calculating the velocity threshold based on the 90th percentile
of events per issue per hour, which is then stored per project in Redis.
"""

import datetime
import logging

import sentry_sdk
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
from sentry.utils.redis import redis_clusters
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)

REFERRER = "sentry.issues.issue_velocity"
CLUSTER_KEY = ""


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
            Function("min", [Column("timestamp")], "first_seen"),  # when the issue was first seen
            Function(
                "countIf",
                [
                    Function("greaterOrEquals", [Column("timestamp"), one_week_ago])
                ],  # count events for the issue that occurred within the past week
                "num_events_for_issue_in_past_week",
            ),
            Function(
                "if",  # if the issue was first seen within the past week, we divide the number of events by its age in hours, otherwise we divide the number of events by 7 days in hours
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
            Condition(
                Column("timestamp"), Op.GTE, ninety_days_ago
            ),  # we include issues up to the oldest retention date so that we can properly determine whether an issue is older than the week or not
            Condition(Column("timestamp"), Op.LT, now),
            Condition(Column("project_id"), Op.EQ, project.id),
        ],
        having=[
            Condition(Column("num_events_for_issues_in_past_week"), Op.GT, 1)
        ],  # exclude any issues that had only 1 event in the past week
        orderby=[OrderBy(Column("first_seen"), Direction.ASC)],
        limit=Limit(10000),
    )

    query = Query(
        match=subquery,
        select=[
            Function("quantile(0.9)", Column("events_per_issue_per_hour"), "p90")
        ],  # get the 90th percentile of the event frequency in the past week
        limit=Limit(1),
    )

    request = Request(
        dataset=Dataset.PerformanceMetrics.value,
        app_id=REFERRER,
        query=query,
        tenant_ids={"referrer": REFERRER, "organization_id": project.organization.id},
    )

    result = raw_snql_query(request, referrer=REFERRER)["data"]
    if len(result) == 0:
        return None

    try:
        return result[0]["p90"]
    except KeyError:
        return None


def set_velocity_threshold_for_project(project: Project) -> None:
    threshold = calculate_velocity_threshold_for_project(project)
    if threshold is None:
        logger.error("Velocity threshold couldn't be calculated", extra={"project_id": project.id})
        return
    # store in redis
    with sentry_sdk.start_span(op="cluster.{CLUSTER_KEY}.set_velocity_threshold_for_project"):
        client = redis_clusters.get(CLUSTER_KEY)
        client.set(project.id, f"{threshold}")


def get_velocity_threshold_for_project(project: Project) -> int:
    # get from redis
    client = redis_clusters.get(CLUSTER_KEY)
    return client.get(project.id)

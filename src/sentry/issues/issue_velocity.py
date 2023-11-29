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
    """
    what am i querying for

    within a project (x), i need the 90th percentile of the number
    of events per issue per hour for each issue (x) that had an
    event within the last week (x)
    """
    now = datetime.now()
    one_week_ago = now - datetime.timedelta(days=7)
    ninety_days_ago = now - datetime.timedelta(days=90)

    # the below query gets the hourly counts for a project
    # query = Query(
    #     match=Entity(EntityKey.Events.value),
    #     select=[Column("time"), Column("group_id"), Function("count", [], "event_count")],
    #     where=[
    #         Condition(Column("timestamp"), Op.LT, now),
    #         Condition(Column("timestamp"), Op.GTE, one_week_ago),
    #         Condition(Column("project_id"), Op.EQ, project.id),
    #     ],
    #     having=[Condition(Column("event_count"), Op.GT, 1)],
    #     groupby=[Column("time"), Column("group_id")],
    #     orderby=[OrderBy(Column("event_count"), Direction.DESC)],
    #     granularity=Granularity(3600),
    # )

    # metrics_query = MetricsQuery(
    #     org_id=project.organization.id,
    #     project_ids=[project.id],
    #     select=MetricField(metric_mri=ErrorsMRI.EVENT_INGESTED.value, alias="event_ingested", op="sum"),
    #     granularity=Granularity(3600),
    #     start=one_week_ago,
    #     end=now,
    #     groupby=[MetricGroupByField(field="group")],
    # )

    # snuba_query = SnubaQueryBuilder([project], metrics_query, UseCaseID.ESCALATING_ISSUES)

    """ @ wednesday isabella this is it i'm pretty fucking sure
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

    """t1. group_id | first_seen within last 90 days | total events for issue within last 90 days
    MATCH (search_issues)
    SELECT group_id, min(timestamp) AS first_seen, count() AS num_events_for_issue
    BY group_id
    WHERE timestamp >= toDateTime('2023-08-27T16:02:34.565803')
        AND timestamp < toDateTime('2023-11-27T16:02:34.565803')
    AND project_id = 1
    HAVING num_events_for_issue > 1 ORDER BY group_id ASC
    """

    """t2. tags.raw_value (group_id) | bucketed_time (start of the hour) | events that occurred in this hour for this issue
    MATCH (generic_metrics_counters)
    SELECT sumIf(value, equals(metric_id, 9223372036854776308)) AS `events_per_hour_for_each_issue`
    BY tags.raw_value, bucketed_time
    WHERE project_id = 1 AND org_id = 1
        AND timestamp >= toDateTime('2023-08-28T21:00:00') AND timestamp < toDateTime('2023-11-28T22:00:00')
        AND bucketed_time >= toDateTime('2023-08-21T21:00:00') AND bucketed_time < toDateTime('2023-11-28T22:00:00')
        AND metric_id IN array(9223372036854776308)
    ORDER BY bucketed_time ASC
    LIMIT 10000 OFFSET 0 GRANULARITY 3600
    """

    """ LOGIC
    older than 1 week (8 days)
    336 events in 7 days / (7 days * 24 hours) = 336 events / 168 = [average of] 2 events / hour

    younger than 1 week (6 days)
    1008 events in 6 days / (168 hours) = 6 events / hour (off, this only happened for 6 days, which is less than 168 hours)
    1008 events in 6 days / (144 hours) = 7 events / hour

    join search_issues and group_attributes
    former will give all the events that occurred for each issue within last week
    latter will give first_seen for the issue
    together, ccan determine whether to divide by 168 hours (a week) or the age of the issue in hours (if it's new)
    """

    """
    MATCH (group_attributes)
    SELECT group_id, group_first_seen
    WHERE project_id = 1
    """

    """
    MATCH (generic_metrics_counters)
    SELECT sumIf(value, equals(metric_id, 9223372036854776308)) AS `events_per_hour_for_each_issue`, if(lessOrEquals(t1.first_seen, one_week_ago), divide(events_per_hour_for_each_issue, 7), divide(events_per_hour_for_each_issue, minus(toDateTime('2023-11-28T22:00:00'), first_seen))) AS `event_frequency_per_hour_per_issue`
    BY tags.raw_value
    WHERE project_id = 1 AND org_id = 1
        AND tags.raw_value IN t1.group_id
        AND timestamp >= toDateTime('2023-08-28T21:00:00') AND timestamp < toDateTime('2023-11-28T22:00:00')
        AND bucketed_time >= toDateTime('2023-08-21T21:00:00') AND bucketed_time < toDateTime('2023-11-28T22:00:00')
        AND metric_id IN array(9223372036854776308)
    ORDER BY bucketed_time ASC
    LIMIT 10000 OFFSET 0 GRANULARITY 3600
    """

    # subquery = Query(
    #     match=Entity(EntityKey.GenericMetricsCounters),
    #     select=[
    #         Column("tags.raw_value"),
    #         Function("sumIf", parameters=[Column("value"), Function("equals", parameters=[Column("metric_id"), UseCaseID.ESCALATING_ISSUES])], alias="events_per_hour_per_issue"),
    #     ],
    #     groupby=[Column("bucketed_time"), Column("tags.raw_value")],
    #     where=[Condition(Column("project_id"), Op.EQ, project.id), Condition(Column("org_id"), Op.EQ, project.organization.id), Condition(Column("timestamp"), Op.GTE, one_week_ago), Condition(Column("timestamp"), Op.LT, now), Condition(Column("metric_id"), Op.EQ, UseCaseID.ESCALATING_ISSUES)],
    #     orderby=[OrderBy(Column("bucketed_time"), Direction.ASC)],
    #     limit=Limit(10000),
    #     granularity=Granularity(3600)
    # )

    # query = Query(
    #     match=subquery,
    #     select=[
    #         Function("quantile(0.9)", parameters=[Column("events_per_hour_per_issue")])
    #     ],
    #     limit=Limit(1)
    # )

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

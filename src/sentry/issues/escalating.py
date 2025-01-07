"""This module has the logic for querying Snuba for the hourly event count for a list of groups.
This is later used for generating group forecasts for determining when a group may be escalating.
"""

from __future__ import annotations

import logging
import math
from collections import defaultdict
from collections.abc import Iterable, Mapping, Sequence
from datetime import datetime, timedelta
from typing import Any, TypedDict

import jsonschema
from django.db.models.signals import post_save
from snuba_sdk import (
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Limit,
    Offset,
    Op,
    OrderBy,
    Query,
    Request,
)
from snuba_sdk.expressions import Granularity

from sentry import features, options
from sentry.eventstore.models import GroupEvent
from sentry.issues.escalating_group_forecast import EscalatingGroupForecast
from sentry.issues.escalating_issues_alg import GroupCount
from sentry.issues.grouptype import GroupCategory
from sentry.issues.priority import PriorityChangeReason, auto_update_priority
from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus
from sentry.models.grouphistory import GroupHistoryStatus, record_group_history
from sentry.models.groupinbox import (
    INBOX_REASON_DETAILS,
    GroupInboxReason,
    InboxReasonDetails,
    add_group_to_inbox,
)
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.signals import issue_escalating
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics import (
    DeprecatingMetricsQuery,
    MetricField,
    MetricGroupByField,
    get_series,
)
from sentry.snuba.metrics.naming_layer.mri import ErrorsMRI
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus
from sentry.utils.cache import cache
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)

__all__ = ["query_groups_past_counts", "parse_groups_past_counts"]

REFERRER = "sentry.issues.escalating"
# The amount of data needed to generate a group forecast
BUCKETS_PER_GROUP = 7 * 24
IS_ESCALATING_REFERRER = "sentry.issues.escalating.is_escalating"
GROUP_HOURLY_COUNT_TTL = 60
HOUR = 3600  # 3600 seconds

ELEMENTS_PER_SNUBA_PAGE = 10000  # This is the maximum value for Snuba
ELEMENTS_PER_SNUBA_METRICS_QUERY = math.floor(
    ELEMENTS_PER_SNUBA_PAGE / BUCKETS_PER_GROUP
)  # This is the maximum value for Snuba Metrics Query

GroupsCountResponse = TypedDict(
    "GroupsCountResponse",
    {"group_id": int, "hourBucket": str, "count()": int, "project_id": int},
)

ParsedGroupsCount = dict[int, GroupCount]


def query_groups_past_counts(groups: Iterable[Group]) -> list[GroupsCountResponse]:
    """Query Snuba for the counts for every group bucketed into hours.

    It optimizes the query by guaranteeing that we look at group_ids that are from the same project id.
    This is important for Snuba as the data is stored in blocks related to the project id.

    If the group's issue type does not allow escalation, it will not be included in the query.

    We maximize the number of projects and groups to reduce the total number of Snuba queries.
    Each project may not have enough groups in order to reach the max number of returned
    elements (ELEMENTS_PER_SNUBA_PAGE), thus, projects with few groups should be grouped together until
    we get at least a certain number of groups.

    NOTE: Groups with less than the maximum number of buckets (think of groups with just 1 event or less
    than 7 days old) will skew the optimization since we may only get one page and less elements than the max
    ELEMENTS_PER_SNUBA_PAGE.
    """
    all_results: list[GroupsCountResponse] = []
    if not groups:
        return all_results

    start_date, end_date = _start_and_end_dates()

    # Error groups use the events dataset while profile and perf groups use the issue platform dataset
    error_groups: list[Group] = []
    other_groups: list[Group] = []
    for g in groups:
        if g.issue_category == GroupCategory.ERROR:
            error_groups.append(g)
        elif g.issue_type.should_detect_escalation():
            other_groups.append(g)

    all_results += _process_groups(error_groups, start_date, end_date, GroupCategory.ERROR)
    all_results += _process_groups(other_groups, start_date, end_date)

    return all_results


def _process_groups(
    groups: Sequence[Group],
    start_date: datetime,
    end_date: datetime,
    category: GroupCategory | None = None,
) -> list[GroupsCountResponse]:
    """Given a list of groups, query Snuba for their hourly bucket count.
    The category defines which Snuba dataset and entity we query."""
    all_results: list[GroupsCountResponse] = []
    if not groups:
        return all_results

    group_ids_by_project_by_organization = _extract_organization_and_project_and_group_ids(groups)
    proj_ids, group_ids = [], []
    processed_projects = 0

    # This iteration guarantees that all groups for a project will be queried in the same call
    # and only one page where the groups could be mixed with groups from another project
    # Iterating over the sorted keys guarantees results for tests
    for organization_id in sorted(group_ids_by_project_by_organization.keys()):
        group_ids_by_project = group_ids_by_project_by_organization[organization_id]
        total_projects_count = len(group_ids_by_project)

        for proj_id in sorted(group_ids_by_project.keys()):
            _group_ids = group_ids_by_project[proj_id]
            # Add them to the list of projects and groups to query
            proj_ids.append(proj_id)
            group_ids += _group_ids
            processed_projects += 1
            potential_num_elements = len(_group_ids) * BUCKETS_PER_GROUP
            # This is trying to maximize the number of groups on the first page
            if (
                processed_projects < total_projects_count
                and potential_num_elements < ELEMENTS_PER_SNUBA_PAGE
            ):
                continue

            # TODO: Write this as a dispatcher type task and fire off a separate task per proj_ids
            all_results += _query_with_pagination(
                organization_id, proj_ids, group_ids, start_date, end_date, category
            )

            # We're ready for a new set of projects and ids
            proj_ids, group_ids = [], []

    return all_results


def _query_with_pagination(
    organization_id: int,
    project_ids: Sequence[int],
    group_ids: Sequence[int],
    start_date: datetime,
    end_date: datetime,
    category: GroupCategory | None = None,
) -> list[GroupsCountResponse]:
    """Query Snuba for event counts for the given list of project ids and groups ids in
    a time range."""
    all_results = []
    offset = 0

    while True:
        query = _generate_entity_dataset_query(
            project_ids, group_ids, offset, start_date, end_date, category
        )
        request = Request(
            dataset=_issue_category_dataset(category),
            app_id=REFERRER,
            query=query,
            tenant_ids={"referrer": REFERRER, "organization_id": organization_id},
        )
        results = raw_snql_query(request, referrer=REFERRER)["data"]

        all_results += results
        offset += ELEMENTS_PER_SNUBA_PAGE
        if not results or len(results) < ELEMENTS_PER_SNUBA_PAGE:
            break

    _query_metrics_with_pagination(
        organization_id, project_ids, group_ids, start_date, end_date, all_results, category
    )
    return all_results


def _query_metrics_with_pagination(
    organization_id: int,
    project_ids: Sequence[int],
    group_ids: Sequence[int],
    start_date: datetime,
    end_date: datetime,
    all_results: Sequence[GroupsCountResponse],
    category: GroupCategory | None = None,
) -> None:
    """
    Paginates Snuba metric queries for event counts for the
    given list of project ids and groups ids in a time range.

    Checks if the returned results are equivalent to `all_results`.
    If not equivalent, it will generate a log.
    """
    organization = Organization.objects.get(id=organization_id)

    if category == GroupCategory.ERROR and features.has(
        "organizations:escalating-issues-v2", organization
    ):
        metrics_results = []
        metrics_offset = 0

        while True:
            # Generate and execute the query to the Generics Metrics Backend
            metrics_query = _generate_generic_metrics_backend_query(
                organization_id,
                project_ids,
                group_ids,
                start_date,
                end_date,
                metrics_offset,
                category,
            )
            projects = list(Project.objects.filter(id__in=project_ids))
            metrics_series_results = get_series(
                projects=projects,
                metrics_query=metrics_query,
                use_case_id=UseCaseID.ESCALATING_ISSUES,
            )

            metrics_results += transform_to_groups_count_response(metrics_series_results)
            metrics_offset += ELEMENTS_PER_SNUBA_METRICS_QUERY

            if (
                not metrics_series_results["groups"]
                or len(metrics_series_results["groups"]) < ELEMENTS_PER_SNUBA_METRICS_QUERY
            ):
                break

        # Log exception if results from the Metrics backend are
        # not equivalent to the Errors dataset.
        if not compare_lists(metrics_results, all_results):
            logger.info(
                "Generics Metrics Backend query results not the same as Errors dataset query.",
                extra={"metrics_results": metrics_results, "dataset_results": all_results},
            )


def transform_to_groups_count_response(data: Mapping[str, Any]) -> list[GroupsCountResponse]:
    """
    Transforms results from `get_series` metrics query to List[GroupsCountResponse]
    """
    result: list[GroupsCountResponse] = []

    for group in data["groups"]:
        project_id = group["by"]["project_id"]
        group_id = int(group["by"]["group"])
        for interval, count in zip(data["intervals"], group["series"]["event_ingested"]):
            if count > 0:
                result.append(
                    {
                        "project_id": project_id,
                        "group_id": group_id,
                        "hourBucket": interval.isoformat(),
                        "count()": count,
                    }
                )

    return result


def compare_lists(
    list1: Sequence[GroupsCountResponse], list2: Sequence[GroupsCountResponse]
) -> bool:
    # Convert each dictionary in the list to a frozenset so it's hashable
    set1 = set(map(lambda x: frozenset(x.items()), list1))
    set2 = set(map(lambda x: frozenset(x.items()), list2))

    return set1 == set2


def _generate_generic_metrics_backend_query(
    organization_id: int,
    project_ids: Sequence[int],
    group_ids: Sequence[int],
    start_date: datetime,
    end_date: datetime,
    offset: int,
    category: GroupCategory | None = None,
) -> DeprecatingMetricsQuery:
    """
    This function generates a query to fetch the hourly events
    for a group_id through the Generic Metrics Backend.

    The Generic Metrics Backend only contains data for Errors.
    """

    # Check if category is for Errors, else raise an exception
    if category is None or category != GroupCategory.ERROR:
        raise Exception("Invalid category.")

    select = [
        MetricField(metric_mri=ErrorsMRI.EVENT_INGESTED.value, alias="event_ingested", op="sum"),
    ]

    groupby = [MetricGroupByField(field="project_id"), MetricGroupByField(field="group")]

    where = [
        Condition(
            lhs=Column(name="tags[group]"),
            op=Op.IN,
            rhs=[str(group_id) for group_id in group_ids],
        )
    ]
    return DeprecatingMetricsQuery(
        org_id=organization_id,
        project_ids=project_ids,
        select=select,
        start=start_date,
        end=end_date,
        where=where,
        granularity=Granularity(HOUR),
        groupby=groupby,
        offset=Offset(offset),
        limit=Limit(ELEMENTS_PER_SNUBA_METRICS_QUERY),
        include_totals=False,
    )


def _generate_entity_dataset_query(
    project_ids: Sequence[int],
    group_ids: Sequence[int],
    offset: int,
    start_date: datetime,
    end_date: datetime,
    category: GroupCategory | None = None,
) -> Query:
    """This simply generates a query based on the passed parameters"""
    group_id_col = Column("group_id")
    proj_id_col = Column("project_id")

    return Query(
        match=Entity(_issue_category_entity(category)),
        select=[
            proj_id_col,
            group_id_col,
            Function("toStartOfHour", [Column("timestamp")], "hourBucket"),
            Function("count", []),
        ],
        groupby=[proj_id_col, group_id_col, Column("hourBucket")],
        where=[
            Condition(proj_id_col, Op.IN, Function("tuple", project_ids)),
            Condition(Column("group_id"), Op.IN, Function("tuple", group_ids)),
            Condition(Column("timestamp"), Op.GTE, start_date),
            Condition(Column("timestamp"), Op.LT, end_date),
        ],
        limit=Limit(ELEMENTS_PER_SNUBA_PAGE),
        offset=Offset(offset),
        orderby=[
            OrderBy(proj_id_col, Direction.ASC),
            OrderBy(group_id_col, Direction.ASC),
            OrderBy(Column("hourBucket"), Direction.ASC),
        ],
    )


def _start_and_end_dates(hours: int = BUCKETS_PER_GROUP) -> tuple[datetime, datetime]:
    """Return the start and end date of N hours time range."""
    end_datetime = datetime.now()
    return end_datetime - timedelta(hours=hours), end_datetime


def _extract_project_and_group_ids(groups: Sequence[Group]) -> dict[int, list[int]]:
    """Return all project and group IDs from a list of Group"""
    group_ids_by_project: dict[int, list[int]] = defaultdict(list)
    for group in groups:
        group_ids_by_project[group.project_id].append(group.id)

    return group_ids_by_project


def _extract_organization_and_project_and_group_ids(
    groups: Sequence[Group],
) -> dict[int, dict[int, list[int]]]:
    """Returns an object of organization by project by list of group ids from a list of Group"""
    group_ids_by_project = _extract_project_and_group_ids(groups)
    group_ids_by_organization: dict[int, dict[int, list[int]]] = defaultdict(dict)
    for group in groups:
        group_ids_by_organization[group.project.organization_id].update(
            {group.project_id: group_ids_by_project[group.project_id]}
        )
    return group_ids_by_organization


def get_group_hourly_count(group: Group) -> int:
    """Return the number of events a group has had today in the last hour"""
    key = f"hourly-group-count:{group.project.id}:{group.id}"
    hourly_count = cache.get(key)

    if hourly_count is None:
        now = datetime.now()
        current_hour = now.replace(minute=0, second=0, microsecond=0)
        query = Query(
            match=Entity(_issue_category_entity(group.issue_category)),
            select=[
                Function("count", []),
            ],
            where=[
                Condition(Column("project_id"), Op.EQ, group.project.id),
                Condition(Column("group_id"), Op.EQ, group.id),
                Condition(Column("timestamp"), Op.GTE, current_hour),
                Condition(Column("timestamp"), Op.LT, now),
            ],
        )
        request = Request(
            dataset=_issue_category_dataset(group.issue_category),
            app_id=IS_ESCALATING_REFERRER,
            query=query,
            tenant_ids={
                "referrer": IS_ESCALATING_REFERRER,
                "organization_id": group.project.organization.id,
            },
        )
        hourly_count = int(
            raw_snql_query(request, referrer=IS_ESCALATING_REFERRER)["data"][0]["count()"]
        )
        cache.set(key, hourly_count, GROUP_HOURLY_COUNT_TTL)
    return int(hourly_count)


def is_escalating(group: Group) -> tuple[bool, int | None]:
    """
    Return whether the group is escalating and the daily forecast if it exists.
    """
    group_hourly_count = get_group_hourly_count(group)
    forecast_today = EscalatingGroupForecast.fetch_todays_forecast(group.project.id, group.id)
    # Check if current event occurrence is greater than forecast for today's date
    if forecast_today and group_hourly_count > forecast_today:
        return True, forecast_today
    return False, None


def parse_groups_past_counts(response: Sequence[GroupsCountResponse]) -> ParsedGroupsCount:
    """
    Return the parsed snuba response for groups past counts to be used in generate_issue_forecast.
    ParsedGroupCount is of the form {<group_id>: {"intervals": [str], "data": [int]}}.

    `response`: Snuba response for group event counts
    """
    group_counts: ParsedGroupsCount = {}
    group_ids_list = group_counts.keys()
    for data in response:
        group_id = data["group_id"]
        if group_id not in group_ids_list:
            group_counts[group_id] = {
                "intervals": [data["hourBucket"]],
                "data": [data["count()"]],
            }
        else:
            group_counts[group_id]["intervals"].append(data["hourBucket"])
            group_counts[group_id]["data"].append(data["count()"])
    return group_counts


def _issue_category_dataset(category: GroupCategory | None = None) -> Dataset | str:
    return Dataset.Events.value if category == GroupCategory.ERROR else Dataset.IssuePlatform.value


def _issue_category_entity(category: GroupCategory | None = None) -> EntityKey | str:
    return (
        EntityKey.Events.value if category == GroupCategory.ERROR else EntityKey.IssuePlatform.value
    )


def manage_issue_states(
    group: Group,
    group_inbox_reason: GroupInboxReason,
    event: GroupEvent | None = None,
    snooze_details: InboxReasonDetails | None = None,
    activity_data: Mapping[str, Any] | None = None,
) -> None:
    from sentry.integrations.tasks.kick_off_status_syncs import kick_off_status_syncs

    """
    Handles the downstream changes to the status/substatus of GroupInbox and Group for each GroupInboxReason

    `activity_data`: Additional activity data, such as escalating forecast
    """
    data: dict[str, str | Mapping[str, Any]] | None = (
        {"event_id": event.event_id} if event else None
    )
    if group_inbox_reason == GroupInboxReason.ESCALATING:
        updated = Group.objects.filter(id=group.id, status=GroupStatus.IGNORED).update(
            status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.ESCALATING
        )
        if updated:
            group.status = GroupStatus.UNRESOLVED
            group.substatus = GroupSubStatus.ESCALATING
            if not options.get("groups.enable-post-update-signal"):
                post_save.send(
                    sender=Group,
                    instance=group,
                    created=False,
                    update_fields=["status", "substatus"],
                )
            add_group_to_inbox(group, GroupInboxReason.ESCALATING, snooze_details)
            record_group_history(group, GroupHistoryStatus.ESCALATING)
            kick_off_status_syncs.apply_async(
                kwargs={"project_id": group.project_id, "group_id": group.id}
            )

            has_forecast = (
                True if data and activity_data and "forecast" in activity_data.keys() else False
            )
            issue_escalating.send_robust(
                project=group.project,
                group=group,
                event=event,
                sender=manage_issue_states,
                was_until_escalating=True if has_forecast else False,
                new_substatus=GroupSubStatus.ESCALATING,
            )
            if data and activity_data and has_forecast:  # Redundant checks needed for typing
                data.update(activity_data)
            if data and snooze_details:
                try:
                    jsonschema.validate(snooze_details, INBOX_REASON_DETAILS)

                except jsonschema.ValidationError:
                    logging.exception(
                        "Expired snooze_details invalid jsonschema", extra=snooze_details
                    )

                data.update({"expired_snooze": snooze_details})

            Activity.objects.create_group_activity(
                group=group, type=ActivityType.SET_ESCALATING, data=data
            )
            auto_update_priority(group, PriorityChangeReason.ESCALATING)

    elif group_inbox_reason == GroupInboxReason.ONGOING:
        updated = Group.objects.filter(
            id=group.id, status__in=[GroupStatus.RESOLVED, GroupStatus.IGNORED]
        ).update(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.ONGOING)
        if updated:
            group.status = GroupStatus.UNRESOLVED
            group.substatus = GroupSubStatus.ONGOING
            if not options.get("groups.enable-post-update-signal"):
                post_save.send(
                    sender=Group,
                    instance=group,
                    created=False,
                    update_fields=["status", "substatus"],
                )
            add_group_to_inbox(group, GroupInboxReason.ONGOING, snooze_details)
            record_group_history(group, GroupHistoryStatus.ONGOING)

            Activity.objects.create_group_activity(
                group=group, type=ActivityType.SET_UNRESOLVED, data=data, send_notification=False
            )

    elif group_inbox_reason == GroupInboxReason.UNIGNORED:
        updated = Group.objects.filter(
            id=group.id, status__in=[GroupStatus.RESOLVED, GroupStatus.IGNORED]
        ).update(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.ONGOING)
        if updated:
            group.status = GroupStatus.UNRESOLVED
            group.substatus = GroupSubStatus.ONGOING
            if not options.get("groups.enable-post-update-signal"):
                post_save.send(
                    sender=Group,
                    instance=group,
                    created=False,
                    update_fields=["status", "substatus"],
                )
            add_group_to_inbox(group, GroupInboxReason.UNIGNORED, snooze_details)
            record_group_history(group, GroupHistoryStatus.UNIGNORED)
            Activity.objects.create_group_activity(
                group=group, type=ActivityType.SET_UNRESOLVED, data=data, send_notification=False
            )
            kick_off_status_syncs.apply_async(
                kwargs={"project_id": group.project_id, "group_id": group.id}
            )

    else:
        raise NotImplementedError(
            f"We don't support a change of state for {group_inbox_reason.name}"
        )

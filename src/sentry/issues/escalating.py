"""This module has the logic for querying Snuba for the hourly event count for a list of groups.
This is later used for generating group forecasts for determining when a group may be escalating.
"""

import logging
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Sequence, Tuple, TypedDict

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

from sentry import analytics
from sentry.issues.escalating_group_forecast import EscalatingGroupForecast
from sentry.issues.escalating_issues_alg import GroupCount
from sentry.issues.grouptype import GroupCategory
from sentry.models import Group
from sentry.models.group import GroupStatus
from sentry.models.groupinbox import GroupInboxReason, add_group_to_inbox
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.types.group import GroupSubStatus
from sentry.utils.cache import cache
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)

__all__ = ["parse_groups_past_counts", "is_escalating"]

REFERRER = "sentry.issues.escalating"
ELEMENTS_PER_SNUBA_PAGE = 10000  # This is the maximum value for Snuba
# The amount of data needed to generate a group forecast
BUCKETS_PER_GROUP = 7 * 24
ONE_WEEK_DURATION = 7
IS_ESCALATING_REFERRER = "sentry.issues.escalating.is_escalating"
GROUP_DAILY_COUNT_TTL = 60

GroupsCountResponse = TypedDict(
    "GroupsCountResponse",
    {"group_id": int, "hourBucket": str, "count()": int, "project_id": int},
)

ParsedGroupsCount = Dict[int, GroupCount]


def query_groups_past_counts(groups: Sequence[Group]) -> List[GroupsCountResponse]:
    """Query Snuba for the counts for every group bucketed into hours.

    It optimizes the query by guaranteeing that we look at group_ids that are from the same project id.
    This is important for Snuba as the data is stored in blocks related to the project id.

    We maximize the number of projects and groups to reduce the total number of Snuba queries.
    Each project may not have enough groups in order to reach the max number of returned
    elements (ELEMENTS_PER_SNUBA_PAGE), thus, projects with few groups should be grouped together until
    we get at least a certain number of groups.

    NOTE: Groups with less than the maximum number of buckets (think of groups with just 1 event or less
    than 7 days old) will skew the optimization since we may only get one page and less elements than the max
    ELEMENTS_PER_SNUBA_PAGE.
    """
    all_results = []  # type: ignore[var-annotated]
    if not groups:
        return all_results

    processor = GroupCountProcessor(category=GroupCategory.ERROR)
    all_results += processor.query_groups_past_counts(groups)

    return all_results


class GroupCountProcessor:
    """Instanciate this class with a group category and then call query_groups_past_counts to
    query Snuba for the counts for every group bucketed into hours."""

    def __init__(self, category: GroupCategory) -> None:
        self.category = category
        self.start_date, self.end_date = _start_and_end_dates()

    def query_groups_past_counts(self, groups: Sequence[Group]) -> List[GroupsCountResponse]:
        """Given a list of groups, query Snuba for their hourly bucket count."""
        all_results = []  # type: ignore[var-annotated]
        if not groups:
            return all_results

        group_ids_by_project = self._extract_project_and_group_ids(groups)
        proj_ids, group_ids = [], []
        processed_projects = 0
        total_projects_count = len(group_ids_by_project)
        organization_id = groups[0].project.organization.id

        # This iteration guarantees that all groups for a project will be queried in the same call
        # and only one page where the groups could be mixed with groups from another project
        # Iterating over the sorted keys guarantees results for tests
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

            all_results += self._query_with_pagination(organization_id, proj_ids, group_ids)
            # We're ready for a new set of projects and ids
            proj_ids, group_ids = [], []

        return all_results

    def _query_with_pagination(
        self,
        organization_id: int,
        project_ids: Sequence[int],
        group_ids: Sequence[int],
    ) -> List[GroupsCountResponse]:
        """Query Snuba for event counts for the given list of project ids and groups ids in
        a time range."""
        all_results = []
        offset = 0
        while True:
            query = self._generate_query(project_ids, group_ids, offset)
            request = Request(
                dataset=_issue_category_dataset(self.category),
                app_id=REFERRER,
                query=query,
                tenant_ids={"referrer": REFERRER, "organization_id": organization_id},
            )
            results = raw_snql_query(request, referrer=REFERRER)["data"]
            all_results += results
            offset += ELEMENTS_PER_SNUBA_PAGE
            if not results or len(results) < ELEMENTS_PER_SNUBA_PAGE:
                break

        return all_results

    def _generate_query(
        self,
        project_ids: Sequence[int],
        group_ids: Sequence[int],
        offset: int,
    ) -> Query:
        """This simply generates a query based on the passed parameters"""
        group_id_col = Column("group_id")
        proj_id_col = Column("project_id")
        return Query(
            match=Entity(_issue_category_entity(self.category)),
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
                Condition(Column("timestamp"), Op.GTE, self.start_date),
                Condition(Column("timestamp"), Op.LT, self.end_date),
            ],
            limit=Limit(ELEMENTS_PER_SNUBA_PAGE),
            offset=Offset(offset),
            orderby=[
                OrderBy(proj_id_col, Direction.ASC),
                OrderBy(group_id_col, Direction.ASC),
                OrderBy(Column("hourBucket"), Direction.ASC),
            ],
        )

    def _extract_project_and_group_ids(self, groups: Sequence[Group]) -> Dict[int, List[int]]:
        """Return all project and group IDs from a list of Group"""
        group_ids_by_project: Dict[int, List[int]] = defaultdict(list)
        for group in groups:
            group_ids_by_project[group.project_id].append(group.id)

        return group_ids_by_project


def _start_and_end_dates(hours: int = BUCKETS_PER_GROUP) -> Tuple[datetime, datetime]:
    """Return the start and end date of N hours time range."""
    end_datetime = datetime.now()
    return end_datetime - timedelta(hours=hours), end_datetime


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


def get_group_daily_count(organization_id: int, project_id: int, group: Group) -> int:
    """Return the number of events a group has had today"""
    key = f"daily-group-count:{project_id}:{group.id}"
    daily_count = cache.get(key)

    if daily_count is None:
        today = datetime.now().date()
        midnight = datetime.combine(today, datetime.min.time())
        now = datetime.now()
        query = Query(
            match=Entity(_issue_category_entity(group.issue_category)),
            select=[
                Function("count", []),
            ],
            where=[
                Condition(Column("project_id"), Op.EQ, project_id),
                Condition(Column("group_id"), Op.EQ, group.id),
                Condition(Column("timestamp"), Op.GTE, midnight),
                Condition(Column("timestamp"), Op.LT, now),
            ],
        )
        request = Request(
            dataset=_issue_category_dataset(group.issue_category),
            app_id=IS_ESCALATING_REFERRER,
            query=query,
            tenant_ids={"referrer": IS_ESCALATING_REFERRER, "organization_id": organization_id},
        )
        daily_count = int(
            raw_snql_query(request, referrer=IS_ESCALATING_REFERRER)["data"][0]["count()"]
        )
        cache.set(key, daily_count, GROUP_DAILY_COUNT_TTL)
    return int(daily_count)


def is_escalating(group: Group) -> bool:
    """Return boolean depending on if the group is escalating or not"""
    group_daily_count = get_group_daily_count(
        group.project.organization.id, group.project.id, group
    )
    forecast_today = EscalatingGroupForecast.fetch_todays_forecast(group.project.id, group.id)
    # Check if current event occurance is greater than forecast for today's date
    if group_daily_count > forecast_today:
        group.substatus = GroupSubStatus.ESCALATING
        group.status = GroupStatus.UNRESOLVED
        add_group_to_inbox(group, GroupInboxReason.ESCALATING)

        analytics.record(
            "issue.escalating",
            organization_id=group.project.organization.id,
            project_id=group.project.id,
            group_id=group.id,
        )
        return True
    return False


def _issue_category_dataset(category: GroupCategory) -> Dataset:
    if category == GroupCategory.ERROR:
        return Dataset.Events.value
    else:
        raise NotImplementedError


def _issue_category_entity(category: GroupCategory) -> EntityKey:
    if category == GroupCategory.ERROR:
        return EntityKey.Events.value
    else:
        raise NotImplementedError

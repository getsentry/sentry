from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, List, Mapping, Optional, Tuple

from snuba_sdk import (
    BooleanCondition,
    BooleanOp,
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Op,
    OrderBy,
    Query,
    Request,
)

from sentry import analytics, features
from sentry.eventstore.models import Event
from sentry.models.eventuser import EventUser as EventUser_model
from sentry.models.project import Project
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.utils.avatar import get_gravatar_url
from sentry.utils.datastructures import BidirectionalMapping
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)

REFERRER = "sentry.utils.eventuser"

SNUBA_KEYWORD_MAP = BidirectionalMapping(
    {
        ("user_id"): "id",
        ("user_name"): "username",
        ("user_email"): "email",
        ("ip_address_v4", "ip_address_v6"): "ip",
    }
)

# The order of these keys are significant to also indicate priority
# when used in hashing and determining uniqueness. If you change the order
# you will break stuff.
KEYWORD_MAP = BidirectionalMapping(
    {
        "user_ident": "id",
        "username": "username",
        "email": "email",
        "ip_address": "ip",
    }
)

SNUBA_COLUMN_COALASCE = {"ip_address_v4": "IPv4StringToNum", "ip_address_v6": "IPv6StringToNum"}


@dataclass
class EventUser:
    project_id: Optional[int]
    email: Optional[str]
    username: Optional[str]
    name: Optional[str]
    ip_address: Optional[str]
    user_ident: Optional[int]
    id: Optional[int] = None  # EventUser model id

    @staticmethod
    def from_event(event: Event) -> EventUser:
        return EventUser(
            id=None,
            project_id=event.project_id if event else None,
            email=event.data.get("user", {}).get("email") if event else None,
            username=event.data.get("user", {}).get("username") if event else None,
            name=event.data.get("user", {}).get("name")
            or event.data.get("user", {}).get("username")
            if event
            else None,
            ip_address=event.data.get("user", {}).get("ip_address") if event else None,
            user_ident=event.data.get("user", {}).get("id") if event else None,
        )

    def get_display_name(self):
        return self.name or self.email or self.username

    @classmethod
    def for_projects(
        self,
        projects: List[Project],
        keyword_filters: Mapping[str, List[Any]],
        filter_boolean="AND",
        return_all=False,
    ) -> List[EventUser]:
        """
        Fetch the EventUser with a Snuba query that exists within a list of projects
        and valid `keyword_filters`. The `keyword_filter` keys are in `KEYWORD_MAP`.
        """
        oldest_project = min(projects, key=lambda item: item.date_added)

        where_conditions = [
            Condition(Column("project_id"), Op.IN, [p.id for p in projects]),
            Condition(Column("timestamp"), Op.LT, datetime.now()),
            Condition(Column("timestamp"), Op.GTE, oldest_project.date_added),
        ]

        keyword_where_conditions = []
        for keyword, value in keyword_filters.items():
            if not isinstance(value, list):
                raise Exception(f"{keyword} filter must be a list of values")

            snuba_column = SNUBA_KEYWORD_MAP.get_key(keyword)
            if isinstance(snuba_column, tuple):
                for filter_value in value:
                    keyword_where_conditions.append(
                        BooleanCondition(
                            BooleanOp.OR,
                            [
                                Condition(
                                    Column(column),
                                    Op.IN,
                                    value
                                    if SNUBA_COLUMN_COALASCE.get(column, None) is None
                                    else Function(
                                        SNUBA_COLUMN_COALASCE.get(column), parameters=[filter_value]
                                    ),
                                )
                                for column in snuba_column
                            ],
                        )
                    )
            else:
                keyword_where_conditions.append(Condition(Column(snuba_column), Op.IN, value))

        if len(keyword_where_conditions) > 1:
            where_conditions.append(
                BooleanCondition(
                    BooleanOp.AND if filter_boolean == "AND" else BooleanOp.OR,
                    keyword_where_conditions,
                )
            )

        if len(keyword_where_conditions) == 1:
            where_conditions.extend(
                keyword_where_conditions,
            )

        columns = [
            Column("project_id"),
            Column("group_id"),
            Column("ip_address_v6"),
            Column("ip_address_v4"),
            Column("user_id"),
            Column("user"),
            Column("user_name"),
            Column("user_email"),
        ]

        query = Query(
            match=Entity(EntityKey.Events.value),
            select=[
                *columns,
                Function("max", [Column("timestamp")], "latest_timestamp"),
            ],
            where=where_conditions,
            groupby=[*columns],
            orderby=[OrderBy(Column("latest_timestamp"), Direction.DESC)],
        )

        if not return_all:
            query.set_limit(1)

        request = Request(
            dataset=Dataset.Events.value,
            app_id=REFERRER,
            query=query,
            tenant_ids={"referrer": REFERRER, "organization_id": projects[0].organization.id},
        )
        data_results = raw_snql_query(request, referrer=REFERRER)["data"]

        # Return the first matching item from the Snuba results.
        # All other rows are not needed.
        # The Snuba results are sorted by descending time.
        first_matching_items = []

        snuba_keyword_filters = {}
        for keyword, value in keyword_filters.items():
            snuba_column = SNUBA_KEYWORD_MAP.get_key(keyword)
            snuba_keyword_filters[snuba_column] = value

        matches = self._find_matching_items(data_results, snuba_keyword_filters, filter_boolean)
        first_matching_items.extend(matches.values())

        results = [EventUser.from_snuba(item) for item in first_matching_items]

        analytics.record(
            "eventuser_snuba.query",
            project_ids=[p.id for p in projects],
            query=query.print(),
            count_rows_returned=len(data_results),
            count_rows_filtered=len(data_results) - len(results),
        )

        return results

    @staticmethod
    def _find_matching_items(
        snuba_results: List[dict[str, Any]], filters: Mapping[str, Any], filter_boolean: str
    ):
        """
        If the filter boolean is OR, for each of the keyword filters get the first matching item.
        If the filter boolean is AND, get the first matching item that has all of the keyword filters.
        """
        matches = {}

        if filter_boolean == "OR":
            for key, values in filters.items():
                for value in values:
                    matching_item = next(
                        (
                            item
                            for item in snuba_results
                            if (
                                item.get(key) == value
                                if isinstance(key, str)
                                else any(item.get(sub_key) == value for sub_key in key)
                            )
                        ),
                        None,
                    )

                    if matching_item:
                        matches[(key, value)] = matching_item

        if filter_boolean == "AND":
            matching_item = next(
                (
                    item
                    for item in snuba_results
                    if all(
                        (
                            item.get(k) == v[0]
                            if isinstance(k, str)
                            else any(item.get(sub_k) == v[0] for sub_k in k)
                        )
                        for k, v in filters.items()
                    )
                ),
                None,
            )
            if matching_item:
                key, value = (
                    "+".join(k if isinstance(k, str) else "+".join(k) for k in filters),
                    tuple(tuple(v) for v in filters.values()),
                )

                matches[(key, value)] = matching_item

        return matches

    @staticmethod
    def from_snuba(result: Mapping[str, Any]) -> EventUser:
        """
        Converts the object from the Snuba query into an EventUser instance
        """
        return EventUser(
            id=None,
            project_id=result.get("project_id"),
            email=result.get("user_email"),
            username=result.get("user_name"),
            name=result.get("user_name"),
            ip_address=result.get("ip_address_v4") or result.get("ip_address_v6"),
            user_ident=result.get("user_id"),
        )

    @classmethod
    def for_tags(cls, project_id: int, values):
        """
        Finds matching EventUser objects from a list of tag values.

        Return a dictionary of {tag_value: event_user}.
        """
        projects = Project.objects.filter(id=project_id)

        if not features.has("organizations:eventuser-from-snuba", projects[0].organization):
            return EventUser_model.for_tags(project_id, values)

        result = {}
        keyword_filters: Dict[str, Any] = {}
        for value in values:
            key, value = value.split(":", 1)[0], value.split(":", 1)[-1]
            if keyword_filters.get(key):
                keyword_filters[key].append(value)
            else:
                keyword_filters[key] = [value]

        eventusers = EventUser.for_projects(
            projects, keyword_filters, filter_boolean="OR", return_all=True
        )

        for keyword, values in keyword_filters.items():
            column = KEYWORD_MAP.get_key(keyword)
            for value in values:
                matching_euser = next(
                    (euser for euser in eventusers if getattr(euser, column, None) == value), None
                )
                if matching_euser:
                    result[f"{keyword}:{value}"] = matching_euser

        return result

    @property
    def tag_value(self):
        """
        Return the identifier used with tags to link this user.
        """
        for key, value in self.iter_attributes():
            if value:
                return f"{KEYWORD_MAP[key]}:{value}"

    def iter_attributes(self):
        """
        Iterate over key/value pairs for this EventUser in priority order.
        """
        for key in KEYWORD_MAP.keys():
            yield key, getattr(self, key)

    def serialize(self):
        return {
            "id": str(self.id),
            "username": self.username,
            "email": self.email,
            "name": self.get_display_name(),
            "ipAddress": self.ip_address,
            "avatarUrl": get_gravatar_url(self.email, size=32),
        }


def find_eventuser_with_snuba(event: Event):
    """
    Query Snuba to get the EventUser information for an Event.
    """
    start_date, end_date = _start_and_end_dates(event.datetime)

    query = _generate_entity_dataset_query(
        event.project_id, event.group_id, event.event_id, start_date, end_date
    )
    request = Request(
        dataset=Dataset.Events.value,
        app_id=REFERRER,
        query=query,
        tenant_ids={"referrer": REFERRER, "organization_id": event.project.organization.id},
    )
    data_results = raw_snql_query(request, referrer=REFERRER)["data"]

    if len(data_results) == 0:
        logger.info(
            "Errors dataset query to find EventUser did not return any results.",
            extra={
                "event_id": event.event_id,
                "project_id": event.project_id,
                "group_id": event.group_id,
            },
        )
        return {}

    return data_results[0]


def _generate_entity_dataset_query(
    project_id: Optional[int],
    group_id: Optional[int],
    event_id: str,
    start_date: datetime,
    end_date: datetime,
) -> Query:
    """This simply generates a query based on the passed parameters"""
    where_conditions = [
        Condition(Column("event_id"), Op.EQ, event_id),
        Condition(Column("timestamp"), Op.GTE, start_date),
        Condition(Column("timestamp"), Op.LT, end_date),
    ]
    if project_id:
        where_conditions.append(Condition(Column("project_id"), Op.EQ, project_id))

    if group_id:
        where_conditions.append(Condition(Column("group_id"), Op.EQ, group_id))

    return Query(
        match=Entity(EntityKey.Events.value),
        select=[
            Column("project_id"),
            Column("group_id"),
            Column("ip_address_v6"),
            Column("ip_address_v4"),
            Column("event_id"),
            Column("user_id"),
            Column("user"),
            Column("user_name"),
            Column("user_email"),
        ],
        where=where_conditions,
    )


def _start_and_end_dates(time: datetime) -> Tuple[datetime, datetime]:
    """Return the 10 min range start and end time range ."""
    return time - timedelta(minutes=5), time + timedelta(minutes=5)

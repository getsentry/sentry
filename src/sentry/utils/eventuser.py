from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, List, Mapping, Optional, Tuple

from snuba_sdk import Column, Condition, Direction, Entity, Limit, Op, OrderBy, Query, Request

from sentry.eventstore.models import Event
from sentry.models.project import Project
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.utils.avatar import get_gravatar_url
from sentry.utils.datastructures import BidirectionalMapping
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)

REFERRER = "sentry.utils.eventuser"

KEYWORD_MAP = BidirectionalMapping(
    {
        ("user_id"): "id",
        ("user_name"): "username",
        ("email"): "email",
        ("ip_address_4", "ip_address_6"): "ip",
    }
)


@dataclass
class EventUser:
    project_id: Optional[int]
    email: Optional[str]
    username: Optional[str]
    name: Optional[str]
    ip_address: Optional[str]
    user_id: Optional[int]
    id: Optional[int] = None  # EventUser model id

    @staticmethod
    def from_event(event: Event) -> EventUser:
        return EventUser(
            id=None,
            project_id=event.project_id if event else None,
            email=event.data.get("user", {}).get("email") if event else None,
            username=event.data.get("user", {}).get("username") if event else None,
            name=event.data.get("user", {}).get("name") if event else None,
            ip_address=event.data.get("user", {}).get("ip_address") if event else None,
            user_id=event.data.get("user", {}).get("id") if event else None,
        )

    def get_display_name(self):
        return self.name or self.email or self.username

    @classmethod
    def attr_from_keyword(self, keyword):
        return KEYWORD_MAP.get_key(keyword)

    @classmethod
    def for_projects(
        self, projects: List[Project], keyword_filters: Mapping[str, Any]
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

        for keyword, value in keyword_filters.items():
            snuba_column = KEYWORD_MAP.get_key(keyword)
            if isinstance(snuba_column, tuple):
                for column in snuba_column:
                    where_conditions.append(Condition(Column(column), Op.EQ, value))
            else:
                where_conditions.append(Condition(Column(snuba_column), Op.EQ, value))

        query = Query(
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
            limit=Limit(1),
            orderby=[OrderBy(Column("timestamp"), Direction.DESC)],
        )

        request = Request(
            dataset=Dataset.Events.value,
            app_id=REFERRER,
            query=query,
            tenant_ids={"referrer": REFERRER, "organization_id": projects[0].organization.id},
        )
        data_results = raw_snql_query(request, referrer=REFERRER)["data"]
        results = [EventUser.from_snuba(result) for result in data_results]

        return results

    @staticmethod
    def from_snuba(result: Mapping[str, Any]) -> EventUser:
        """
        Converts the object from the Snuba query into an EventUser instance
        """
        return EventUser(
            id=result.get("user_id"),
            project_id=result.get("project_id"),
            email=result.get("user_email"),
            username=result.get("user_name"),
            name=result.get("user_name"),
            ip_address=result.get("ip_address_4") or result.get("ip_address_6"),
            user_id=result.get("user_id"),
        )

    @property
    def tag_value(self) -> str:
        """
        Return the identifier to link this user.
        """
        return f"id:{self.user_id}"

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

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Mapping, Optional

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
            id=event.data.get("user", {}).get("id") if event else None,
            project_id=event.project_id if event else None,
            email=event.data.get("user", {}).get("email") if event else None,
            username=event.data.get("user", {}).get("username") if event else None,
            name=event.data.get("user", {}).get("name") if event else None,
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
        filter_boolean=BooleanOp.AND,
        return_all=False,
    ) -> List[EventUser]:
        """
        Fetch the EventUser with a Snuba query that exists within a list of projects
        and valid `keyword_filters`. The `keyword_filter` keys are in `KEYWORD_MAP`.
        """
        start_time = time.time()

        oldest_project = min(projects, key=lambda item: item.date_added)

        where_conditions = [
            Condition(Column("project_id"), Op.IN, [p.id for p in projects]),
            Condition(Column("timestamp"), Op.LT, datetime.now()),
            Condition(Column("timestamp"), Op.GTE, oldest_project.date_added),
        ]

        keyword_where_conditions = []
        for keyword, value in keyword_filters.items():
            if not isinstance(value, list):
                raise ValueError(f"{keyword} filter must be a list of values")

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
                    filter_boolean,
                    keyword_where_conditions,
                )
            )

        if len(keyword_where_conditions) == 1:
            where_conditions.extend(
                keyword_where_conditions,
            )

        columns = [
            Column("project_id"),
            Column("ip_address_v6"),
            Column("ip_address_v4"),
            Column("user_id"),
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

        results = self._find_unique(data_results)
        end_time = time.time()
        analytics.record(
            "eventuser_snuba.query",
            project_ids=[p.id for p in projects],
            query=query.print(),
            count_rows_returned=len(data_results),
            count_rows_filtered=len(data_results) - len(results),
            query_time_ms=int((end_time - start_time) * 1000),
        )

        return results

    @staticmethod
    def _find_unique(data_results: List[dict[str, Any]]):
        """
        Return the first instance of an EventUser object
        with a unique tag_value from the Snuba results.
        """
        unique_tag_values = set()
        unique_event_users = []

        for euser in [EventUser.from_snuba(item) for item in data_results]:
            tag_value = euser.tag_value
            if tag_value not in unique_tag_values:
                unique_event_users.append(euser)
                unique_tag_values.add(tag_value)

        return unique_event_users

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
            name=None,
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
            projects, keyword_filters, filter_boolean=BooleanOp.OR, return_all=True
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

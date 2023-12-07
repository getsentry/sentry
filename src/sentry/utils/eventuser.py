from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import datetime
from functools import cached_property
from typing import Any, Dict, List, Mapping, Optional, Set

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

from sentry import analytics
from sentry.eventstore.models import Event
from sentry.models.project import Project
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.utils.avatar import get_gravatar_url
from sentry.utils.datastructures import BidirectionalMapping
from sentry.utils.hashlib import md5_text
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
MAX_QUERY_TRIES = 5
OVERFETCH_FACTOR = 10
MAX_FETCH_SIZE = 10_000


@dataclass
class EventUser:
    project_id: Optional[int]
    email: Optional[str]
    username: Optional[str]
    name: Optional[str]
    ip_address: Optional[str]
    user_ident: Optional[int | str]
    id: Optional[int] = None  # EventUser model id

    def __hash__(self):
        return hash(self.hash)

    @staticmethod
    def from_event(event: Event) -> EventUser:
        return EventUser(
            id=None,
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
        filter_boolean: BooleanOp = BooleanOp.AND,
        result_offset: int = 0,
        result_limit: Optional[int] = None,
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

        full_results = []
        tries = 0
        # If we have no result_limit, fetch as many results as we can with a single query
        max_tries = MAX_QUERY_TRIES if result_limit else 1
        target_unique_rows_fetched = None
        if result_limit:
            if result_limit == 1:
                # Special case for fetching one unique eventuser, since we'll only need to get a single row here, no
                # need for deduping
                target_unique_rows_fetched = 1
                query = query.set_limit(1)
            else:
                target_unique_rows_fetched = (result_offset + 1) * result_limit
                # We want to fetch 10x as many rows from the query so that hopefully when we de-dupe we end up with at
                # least as many results as we were looking for
                query = query.set_limit(
                    min((target_unique_rows_fetched * OVERFETCH_FACTOR) + 1, MAX_FETCH_SIZE)
                )

        seen_eventuser_tags: Set[str] = set()
        while tries < max_tries:
            query_start_time = time.time()
            if query.limit:
                # We want to try rows further out on each try
                query = query.set_offset(query.limit.limit * tries)

            request = Request(
                dataset=Dataset.Events.value,
                app_id=REFERRER,
                query=query,
                tenant_ids={"referrer": REFERRER, "organization_id": projects[0].organization.id},
            )
            data_results = raw_snql_query(request, referrer=REFERRER)["data"]

            unique_event_users, seen_eventuser_tags = self._find_unique(
                data_results, seen_eventuser_tags
            )
            full_results.extend(unique_event_users)

            query_end_time = time.time()

            analytics.record(
                "eventuser_snuba.query",
                project_ids=[p.id for p in projects],
                query=query.print(),
                query_try=tries,
                count_rows_returned=len(data_results),
                count_rows_filtered=len(data_results) - len(unique_event_users),
                query_time_ms=int((query_end_time - query_start_time) * 1000),
            )
            tries += 1
            if (
                target_unique_rows_fetched
                and len(full_results) >= target_unique_rows_fetched
                or query.limit
                and len(data_results) < query.limit.limit
            ):
                break

        end_time = time.time()
        analytics.record(
            "eventuser_snuba.for_projects",
            project_ids=[p.id for p in projects],
            total_tries=tries,
            total_rows_returned=len(full_results),
            total_time_ms=int((end_time - start_time) * 1000),
        )

        if result_limit:
            return full_results[result_offset : result_offset + result_limit]
        else:
            return full_results[result_offset:]

    @staticmethod
    def _find_unique(data_results: List[dict[str, Any]], seen_eventuser_tags: Set[str]):
        """
        Return the first instance of an EventUser object
        with a unique tag_value from the Snuba results.
        """
        unique_tag_values = seen_eventuser_tags.copy()
        unique_event_users = []

        for euser in [EventUser.from_snuba(item) for item in data_results]:
            tag_value = euser.tag_value
            if tag_value not in unique_tag_values:
                unique_event_users.append(euser)
                unique_tag_values.add(tag_value)

        return unique_event_users, unique_tag_values

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

        result = {}
        keyword_filters: Dict[str, Any] = {}
        for value in values:
            key, value = value.split(":", 1)[0], value.split(":", 1)[-1]
            if keyword_filters.get(key):
                keyword_filters[key].append(value)
            else:
                keyword_filters[key] = [value]

        eventusers = EventUser.for_projects(projects, keyword_filters, filter_boolean=BooleanOp.OR)

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

    @cached_property
    def hash(self):
        for key, value in self.iter_attributes():
            if value:
                return md5_text(value).hexdigest()

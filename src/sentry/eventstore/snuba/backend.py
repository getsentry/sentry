from __future__ import absolute_import

import six

from copy import deepcopy

from sentry.eventstore.base import EventStorage
from sentry.snuba.events import Columns
from sentry.utils import snuba
from sentry.utils.validators import normalize_event_id

from ..models import Event

EVENT_ID = Columns.EVENT_ID.value.alias
PROJECT_ID = Columns.PROJECT_ID.value.alias
TIMESTAMP = Columns.TIMESTAMP.value.alias

DESC_ORDERING = ["-{}".format(TIMESTAMP), "-{}".format(EVENT_ID)]
ASC_ORDERING = [TIMESTAMP, EVENT_ID]
DEFAULT_LIMIT = 100
DEFAULT_OFFSET = 0


def get_before_event_condition(event):
    return [
        [TIMESTAMP, "<=", event.timestamp],
        [[TIMESTAMP, "<", event.timestamp], [EVENT_ID, "<", event.event_id]],
    ]


def get_after_event_condition(event):
    return [
        [TIMESTAMP, ">=", event.timestamp],
        [[TIMESTAMP, ">", event.timestamp], [EVENT_ID, ">", event.event_id]],
    ]


class SnubaEventStorage(EventStorage):
    """
    Eventstore backend backed by Snuba
    """

    def get_events(
        self,
        filter,
        additional_columns=None,
        orderby=None,
        limit=DEFAULT_LIMIT,
        offset=DEFAULT_OFFSET,
        referrer="eventstore.get_events",
    ):
        """
        Get events from Snuba.
        """
        assert filter, "You must provide a filter"
        cols = self.__get_columns(additional_columns)
        orderby = orderby or DESC_ORDERING

        result = snuba.dataset_query(
            selected_columns=cols,
            start=filter.start,
            end=filter.end,
            conditions=filter.conditions,
            filter_keys=filter.filter_keys,
            orderby=orderby,
            limit=limit,
            offset=offset,
            referrer=referrer,
        )

        if "error" not in result:
            return [self.__make_event(evt) for evt in result["data"]]

        return []

    def get_event_by_id(self, project_id, event_id, additional_columns=None):
        """
        Get an event given a project ID and event ID
        Returns None if an event cannot be found
        """
        cols = self.__get_columns(additional_columns)

        event_id = normalize_event_id(event_id)

        if not event_id:
            return None

        result = snuba.raw_query(
            selected_columns=cols,
            filter_keys={"event_id": [event_id], "project_id": [project_id]},
            referrer="eventstore.get_event_by_id",
            limit=1,
        )
        if "error" not in result and len(result["data"]) == 1:
            return self.__make_event(result["data"][0])
        return None

    def get_earliest_event_id(self, event, filter):
        filter = deepcopy(filter)
        filter.conditions = filter.conditions or []
        filter.conditions.extend(get_before_event_condition(event))
        filter.end = event.datetime

        return self.__get_event_id_from_filter(filter=filter, orderby=ASC_ORDERING)

    def get_latest_event_id(self, event, filter):
        filter = deepcopy(filter)
        filter.conditions = filter.conditions or []
        filter.conditions.extend(get_after_event_condition(event))
        filter.start = event.datetime

        return self.__get_event_id_from_filter(filter=filter, orderby=DESC_ORDERING)

    def get_next_event_id(self, event, filter):
        """
        Returns (project_id, event_id) of a next event given a current event
        and any filters/conditions. Returns None if no next event is found.
        """
        assert filter, "You must provide a filter"

        if not event:
            return None

        filter = deepcopy(filter)
        filter.conditions = filter.conditions or []
        filter.conditions.extend(get_after_event_condition(event))
        filter.start = event.datetime

        return self.__get_event_id_from_filter(filter=filter, orderby=ASC_ORDERING)

    def get_prev_event_id(self, event, filter):
        """
        Returns (project_id, event_id) of a previous event given a current event
        and a filter. Returns None if no previous event is found.
        """
        assert filter, "You must provide a filter"

        if not event:
            return None

        filter = deepcopy(filter)
        filter.conditions = filter.conditions or []
        filter.conditions.extend(get_before_event_condition(event))
        filter.end = event.datetime

        return self.__get_event_id_from_filter(filter=filter, orderby=DESC_ORDERING)

    def __get_columns(self, additional_columns):
        columns = EventStorage.minimal_columns

        if additional_columns:
            columns = set(columns + additional_columns)

        return [col.value.event_name for col in columns]

    def __get_event_id_from_filter(self, filter=None, orderby=None):
        columns = [Columns.EVENT_ID.value.alias, Columns.PROJECT_ID.value.alias]

        try:
            result = snuba.dataset_query(
                selected_columns=columns,
                conditions=filter.conditions,
                filter_keys=filter.filter_keys,
                start=filter.start,
                end=filter.end,
                limit=1,
                referrer="eventstore.get_next_or_prev_event_id",
                orderby=orderby,
                dataset=snuba.detect_dataset({"conditions": filter.conditions}),
            )
        except (snuba.QueryOutsideRetentionError, snuba.QueryOutsideGroupActivityError):
            # This can happen when the date conditions for paging
            # and the current event generate impossible conditions.
            return None

        if "error" in result or len(result["data"]) == 0:
            return None

        row = result["data"][0]

        return (six.text_type(row["project_id"]), six.text_type(row["event_id"]))

    def __make_event(self, snuba_data):
        event_id = snuba_data[Columns.EVENT_ID.value.event_name]
        group_id = snuba_data[Columns.GROUP_ID.value.event_name]
        project_id = snuba_data[Columns.PROJECT_ID.value.event_name]

        return Event(
            event_id=event_id, group_id=group_id, project_id=project_id, snuba_data=snuba_data
        )

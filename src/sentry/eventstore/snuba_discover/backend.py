from __future__ import absolute_import

import six
from copy import deepcopy

from sentry.utils import snuba
from sentry.eventstore.base import EventStorage
from sentry.eventstore.snuba.backend import (
    ASC_ORDERING,
    DESC_ORDERING,
    EVENT_ID,
    PROJECT_ID,
    get_after_event_condition,
    get_before_event_condition,
    SnubaEventStorage,
)
from sentry.snuba.dataset import Dataset


class SnubaDiscoverEventStorage(EventStorage):
    """
    Experimental backend that uses the Snuba Discover dataset instead of Events
    or Transactions directly.
    """

    def get_events(self, *args, **kwargs):
        return SnubaEventStorage().get_events(*args, **kwargs)

    def get_event_by_id(self, *args, **kwargs):
        return SnubaEventStorage().get_event_by_id(*args, **kwargs)

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

    def __get_event_id_from_filter(self, filter=None, orderby=None):
        columns = [EVENT_ID, PROJECT_ID]

        try:
            result = snuba.dataset_query(
                selected_columns=columns,
                conditions=filter.conditions,
                filter_keys=filter.filter_keys,
                start=filter.start,
                end=filter.end,
                limit=1,
                referrer="eventstore.discover_dataset.get_next_or_prev_event_id",
                orderby=orderby,
                dataset=Dataset.Discover,
            )
        except (snuba.QueryOutsideRetentionError, snuba.QueryOutsideGroupActivityError):
            # This can happen when the date conditions for paging
            # and the current event generate impossible conditions.
            return None

        if "error" in result or len(result["data"]) == 0:
            return None

        row = result["data"][0]

        return (six.text_type(row["project_id"]), six.text_type(row["event_id"]))

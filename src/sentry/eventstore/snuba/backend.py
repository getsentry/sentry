from __future__ import absolute_import

from datetime import datetime

from sentry.utils import snuba
from sentry.models import SnubaEvent
from sentry.eventstore.base import EventStorage

DEFAULT_START = datetime.utcfromtimestamp(0)  # will be clamped to project retention
DEFAULT_END = datetime.utcnow()  # will be clamped to project retention
DEFAULT_COLUMNS = EventStorage.minimal_columns
DEFAULT_ORDERBY = ['-timestamp', '-event_id']
DEFAULT_LIMIT = 100
DEFAULT_OFFSET = 0


class SnubaEventStorage(EventStorage):
    """
    Eventstore backend backed by Snuba
    """

    def get_events(
        self,
        start=DEFAULT_START,
        end=DEFAULT_END,
        additional_columns=None,
        conditions=None,
        filter_keys=None,
        orderby=DEFAULT_ORDERBY,
        limit=DEFAULT_LIMIT,
        offset=DEFAULT_OFFSET,
    ):
        """
        Get events from Snuba.
        """
        cols = self.__get_columns(additional_columns)

        result = snuba.raw_query(
            start=start,
            end=end,
            selected_columns=cols,
            conditions=conditions,
            filter_keys=filter_keys,
            limit=limit,
            offset=offset,
            referrer='eventstore.get_events',
        )

        if 'error' not in result:
            return [SnubaEvent(evt) for evt in result['data']]

        return []

    def get_event_by_id(self, project_id, event_id, additional_columns=None):
        """
        Get an event given a project ID and event ID
        Returns None if an event cannot be found
        """
        cols = self.__get_columns(additional_columns)

        return SnubaEvent.get_event(project_id, event_id, snuba_cols=cols)

    def __get_columns(self, additional_columns):
        columns = EventStorage.minimal_columns

        if additional_columns:
            columns = set(columns + additional_columns)

        return [col.value for col in columns]

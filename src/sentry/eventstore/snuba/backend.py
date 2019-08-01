from __future__ import absolute_import

from datetime import datetime

from sentry.utils import snuba
from sentry.models import SnubaEvent
from sentry.eventstore.base import EventStorage

DEFAULT_START = datetime.utcfromtimestamp(0)  # will be clamped to project retention
DEFAULT_END = datetime.utcnow()  # will be clamped to project retention
DEFAULT_ORDERBY = ['-timestamp', '-event_id']
DEFAULT_LIMIT = 100
DEFAULT_OFFSET = 0


class SnubaEventStorage(EventStorage):
    """
    Eventstore backend backed by Snuba
    """

    def get_event_by_id(self, project_id, event_id, additional_columns=None):
        """
        Get an event given a project ID and event ID
        Returns None if an event cannot be found
        """
        cols = self.__get_columns(additional_columns)

        result = snuba.raw_query(
            start=DEFAULT_START,
            end=DEFAULT_END,
            selected_columns=cols,
            filter_keys={
                'event_id': [event_id],
                'project_id': [project_id],
            },
            limit=1,
            referrer='eventstore.get_event_by_id',
        )

        if 'error' not in result and len(result['data']):
            return SnubaEvent(result['data'][0])

        return None

    def __get_columns(self, additional_columns):
        columns = EventStorage.minimal_columns

        if additional_columns:
            columns = set(columns + additional_columns)

        return [col.value for col in columns]

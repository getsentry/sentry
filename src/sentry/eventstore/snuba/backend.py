from __future__ import absolute_import

from sentry.utils import snuba
from sentry.models import SnubaEvent
from sentry.eventstore.base import EventStorage
from sentry.utils.validators import normalize_event_id

DEFAULT_ORDERBY = ['-timestamp', '-event_id']
DEFAULT_LIMIT = 100
DEFAULT_OFFSET = 0


class SnubaEventStorage(EventStorage):
    """
    Eventstore backend backed by Snuba
    """

    def get_events(
        self,
        start=None,
        end=None,
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
            orderby=orderby,
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

        event_id = normalize_event_id(event_id)

        if not event_id:
            return None

        result = snuba.raw_query(
            selected_columns=cols,
            filter_keys={
                'event_id': [event_id],
                'project_id': [project_id],
            },
            referrer='eventstore.get_event_by_id',
            limit=1,
        )
        if 'error' not in result and len(result['data']) == 1:
            return SnubaEvent(result['data'][0])
        return None

    def __get_columns(self, additional_columns):
        columns = EventStorage.minimal_columns

        if additional_columns:
            columns = set(columns + additional_columns)

        return [col.value for col in columns]

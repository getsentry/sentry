from __future__ import absolute_import

from sentry.models import SnubaEvent
from sentry.eventstore.base import EventStorage
from sentry.utils.validators import normalize_event_id


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

        event_id = normalize_event_id(event_id)

        if not event_id:
            return None

        return SnubaEvent.get_event(project_id, event_id, snuba_cols=cols)

    def __get_columns(self, additional_columns):
        columns = EventStorage.minimal_columns

        if additional_columns:
            columns = set(columns + additional_columns)

        return [col.value for col in columns]

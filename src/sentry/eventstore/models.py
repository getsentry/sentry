from __future__ import absolute_import

from datetime import datetime
from django.utils import timezone

from sentry.models import EventCommon, EventDict
from sentry.db.models import NodeData
from sentry.db.models.manager import EventManager


class Event(EventCommon):

    objects = EventManager()

    def __init__(self, project_id, event_id, data):
        self.project_id = project_id
        self.event_id = event_id
        node_id = Event.generate_node_id(self.project_id, event_id)
        self._data = NodeData(None, node_id, data=data, wrapper=EventDict)
        self.group_id = None
        self._group_cache = None
        super(Event, self).__init__()

    def __getstate__(self):
        state = self.__dict__.copy()
        # do not pickle cached info.  We want to fetch this on demand
        # again.  In particular if we were to pickle interfaces we would
        # pickle a CanonicalKeyView which old sentry workers do not know
        # about
        state.pop("_project_cache", None)
        state.pop("_environment_cache", None)
        state.pop("_group_cache", None)
        state.pop("interfaces", None)

        return state

    @property
    def group(self):
        return self._group_cache

    @group.setter
    def group(self, value):
        self._group_cache = value
        self.group_id = value.id if value else None

    @property
    def data(self):
        return self._data

    @data.setter
    def data(self, value):
        self._data = value

    @property
    def platform(self):
        return self.data.get("platform", None)

    @property
    def datetime(self):
        recorded_timestamp = self.data.get("timestamp")
        date = datetime.fromtimestamp(recorded_timestamp)
        date = date.replace(tzinfo=timezone.utc)
        return date

    def save(self):
        """
        Saves event to nodestore.
        """
        self._data.save()

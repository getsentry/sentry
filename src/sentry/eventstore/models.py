from __future__ import absolute_import

from django.utils import timezone

from sentry.models import EventCommon, EventDict
from sentry.db.models import NodeData


class Event(EventCommon):
    def __init__(self, **kwargs):
        self.project_id = kwargs["project_id"]
        self.event_id = kwargs["event_id"]
        node_id = Event.generate_node_id(self.project_id, self.event_id)
        self.data = NodeData(None, node_id, data=kwargs["data"], wrapper=EventDict)
        self.time_spent = kwargs.get("time_spent", None)
        self.platform = kwargs.get("platform", None)
        self.datetime = kwargs.get("datetime", timezone.now())
        self.group = None
        self.group_id = None
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

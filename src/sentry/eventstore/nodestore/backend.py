from __future__ import absolute_import

from datetime import datetime, timedelta

from sentry.eventstore.base import EventStorage
from sentry.utils import snuba
from sentry.utils.validators import normalize_event_id

from ..models import Event


class NodestoreEventStorage(EventStorage):
    def get_event_by_id(self, project_id, event_id, additional_columns=None):
        event_id = normalize_event_id(event_id)

        if not event_id:
            return None

        event = Event(project_id=project_id, event_id=event_id)
        event.bind_node_data()

        # Return None if there was no data in nodestore
        if len(event.data) == 0:
            return None

        event_time = datetime.fromtimestamp(event.data["timestamp"])

        # Load group_id from Snuba if not a transaction
        if event.get_event_type() != "transaction":
            result = snuba.raw_query(
                selected_columns=["group_id"],
                start=event_time,
                end=event_time + timedelta(seconds=1),
                filter_keys={"project_id": [project_id], "event_id": [event_id]},
                limit=1,
            )

            if "error" not in result and len(result["data"]) == 1:
                event.group_id = result["data"][0]["group_id"]

        return event

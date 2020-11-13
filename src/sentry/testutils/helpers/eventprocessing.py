from __future__ import absolute_import

from sentry.eventstore.processing import event_processing_store


def write_event_to_cache(event):
    cache_data = event.data
    cache_data["event_id"] = event.event_id
    cache_data["project"] = event.project_id
    return event_processing_store.store(cache_data)

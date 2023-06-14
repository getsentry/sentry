"""
This defines the "topology" of our services.

In other words, which service (consumer) depends on which other services (queues, processing store).
"""

from dataclasses import dataclass
from typing import Mapping, Set, Union

from django.conf import settings

PROFILING_QUEUES = ["profiles.process"]
PROCESSING_QUEUES = [
    "events.preprocess_event",
    "events.process_event",
    "events.save_event",
    "events.save_event_transaction",
    "events.save_event_attachments",
]
SYMBOLICATION_QUEUES = [
    "events.symbolicate_event",
    "events.symbolicate_js_event",
    "events.symbolicate_event_low_priority",
    "events.symbolicate_js_event_low_priority",
]
REPROCESSING_QUEUES = [
    "events.reprocess_events",
    "events.reprocessing.preprocess_event",
    "events.reprocessing.process_event",
    "events.reprocessing.symbolicate_event",
    "events.reprocessing.symbolicate_event_low_priority",
]

INGEST_QUEUES = PROCESSING_QUEUES + SYMBOLICATION_QUEUES

ALL_QUEUES = PROFILING_QUEUES + PROCESSING_QUEUES + SYMBOLICATION_QUEUES + REPROCESSING_QUEUES


@dataclass(frozen=True)
class Queue:
    name: str


@dataclass(frozen=True)
class Redis:
    name: str


ALL_REDIS_STORES = {
    Redis(cluster) for cluster in settings.SENTRY_PROCESSING_REDIS_CLUSTERS.values()
}


Services = Set[Union[Queue, Redis]]

CONSUMERS: Mapping[str, Services] = {
    # fallback if no explicit consumer was defined
    "default": {Queue(name) for name in ALL_QUEUES}.union(ALL_REDIS_STORES),
    "profiles": {Queue(name) for name in PROFILING_QUEUES},
    # TODO:
    # We might want to eventually make this more fine-grained for different
    # consumer types. For example, normal `ingest-events` does not depend on the
    # `attachments` store, and other ingest
    "ingest": {Queue(name) for name in INGEST_QUEUES}.union(ALL_REDIS_STORES),
}

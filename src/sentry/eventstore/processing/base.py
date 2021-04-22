from datetime import timedelta
from typing import Any, Optional

import sentry_sdk

from sentry.utils.cache import cache_key_for_event
from sentry.utils.kvstore.abstract import KVStorage

DEFAULT_TIMEOUT = 60 * 60 * 24


Event = Any


class EventProcessingStore:
    """
    Store for event blobs during processing

    Ingest processing pipeline tasks are passing event payload through this
    backend instead of the message broker. Tasks are submitted with a key so
    the payload can be retrieved and in case of change saved back to the
    processing store.

    Separating processing store from the cache allows use of different
    implementations.
    """

    def __init__(self, inner: KVStorage[str, Event]):
        self.inner = inner
        self.timeout = timedelta(seconds=DEFAULT_TIMEOUT)

    def __get_unprocessed_key(self, key: str) -> str:
        return key + ":u"

    def store(self, event: Event, unprocessed: bool = False) -> str:
        with sentry_sdk.start_span(op="eventstore.processing.store"):
            key = cache_key_for_event(event)
            if unprocessed:
                key = self.__get_unprocessed_key(key)
            self.inner.set(key, event, self.timeout)
            return key

    def get(self, key: str, unprocessed: bool = False) -> Optional[Event]:
        with sentry_sdk.start_span(op="eventstore.processing.get"):
            if unprocessed:
                key = self.__get_unprocessed_key(key)
            return self.inner.get(key)

    def delete_by_key(self, key: str) -> None:
        with sentry_sdk.start_span(op="eventstore.processing.delete_by_key"):
            self.inner.delete(key)
            self.inner.delete(self.__get_unprocessed_key(key))

    def delete(self, event: Event) -> None:
        key = cache_key_for_event(event)
        self.delete_by_key(key)

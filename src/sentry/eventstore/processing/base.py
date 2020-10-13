from __future__ import absolute_import
from sentry.utils.cache import cache_key_for_event

DEFAULT_TIMEOUT = 60 * 60 * 24


def _get_unprocessed_key(key):
    return key + ":u"


class BaseEventProcessingStore(object):
    """
    Store for event blobs during processing

    Ingest processing pipeline tasks are passing event payload through this
    backend instead of the message broker. Tasks are submitted with a key so
    the payload can be retrieved and in case of change saved back to the
    processing store.

    Separating processing store from the cache allows use of different
    implementations.
    """

    def __init__(self, inner, timeout=DEFAULT_TIMEOUT):
        self.inner = inner
        self.timeout = timeout

    def store(self, event, unprocessed=False):
        key = cache_key_for_event(event)
        if unprocessed:
            key = _get_unprocessed_key(key)
        self.inner.set(key, event, self.timeout)
        return key

    def get(self, key, unprocessed=False):
        if unprocessed:
            key = _get_unprocessed_key(key)
        return self.inner.get(key)

    def delete_by_key(self, key):
        self.inner.delete(key)
        self.inner.delete(_get_unprocessed_key(key))

    def delete(self, event):
        key = cache_key_for_event(event)
        self.delete_by_key(key)

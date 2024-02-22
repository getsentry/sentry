"""Replays storage blob module."""

import logging
from io import BytesIO

from google.api_core.exceptions import TooManyRequests

from sentry import options
from sentry.models.files.utils import get_storage
from sentry.utils import metrics

logger = logging.getLogger()


class SimpleStorageBlob:
    def get(self, key: str) -> bytes | None:
        try:
            storage = get_storage(self._make_storage_options())
            blob = storage.open(key)
            result = blob.read()
            blob.close()
        except Exception:
            logger.warning("Storage GET error.")
            return None
        else:
            return result

    def set(self, key: str, value: bytes) -> None:
        storage = get_storage(self._make_storage_options())
        try:
            storage.save(key, BytesIO(value))
        except TooManyRequests:
            # if we 429 because of a dupe segment problem, ignore it
            metrics.incr("replays.lib.storage.TooManyRequests")

    def delete(self, key: str) -> None:
        storage = get_storage(self._make_storage_options())
        storage.delete(key)

    def initialize_client(self):
        storage = get_storage(self._make_storage_options())
        # acccess the storage client so it is initialized below.
        # this will prevent race condition parallel credential getting during segment download
        # when using many threads
        # the storage client uses a global so we don't need to store it here.
        if hasattr(storage, "client"):
            storage.client

    def _make_storage_options(self) -> dict | None:
        backend = options.get("replay.storage.backend")
        if backend:
            return {"backend": backend, "options": options.get("replay.storage.options")}
        else:
            return None


# Simple Key-value blob storage interface.
storage_kv = SimpleStorageBlob()

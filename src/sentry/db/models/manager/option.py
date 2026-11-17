from __future__ import annotations

from typing import Any

from django.core.signals import request_finished
from django.db.models import Model

from sentry.db.models.manager.base import BaseManager, _local_cache
from sentry.db.models.manager.types import M
from sentry.utils.cache import cache


class OptionManager(BaseManager[M]):
    @property
    def _option_cache(self) -> dict[str, dict[str, Any]]:
        if not hasattr(_local_cache, "option_cache"):
            _local_cache.option_cache = {}

        return _local_cache.option_cache

    def clear_local_cache(self, **kwargs: Any) -> None:
        self._option_cache.clear()

    def reload_task_local_cache(self, instance_id: int) -> None:
        """
        Bring this process's cached options for one instance in line with the
        shared cache.

        A web request clears the local cache when it finishes (`request_finished`),
        but a long-running task worker never finishes a request, so it would keep
        the options it read first. A task that must see options saved by other
        processes calls this before reading them.
        """
        cache_key = self._make_key(instance_id)
        result = cache.get(cache_key)
        if result is None:
            # Nothing shared: drop the local copy, so the next read queries the
            # database.
            self._option_cache.pop(cache_key, None)
        else:
            self._option_cache[cache_key] = result

    def contribute_to_class(self, model: type[Model], name: str) -> None:
        super().contribute_to_class(model, name)
        request_finished.connect(self.clear_local_cache)

    def _make_key(self, instance_id: int | str) -> str:
        assert instance_id
        return f"{self.model._meta.db_table}:{instance_id}"

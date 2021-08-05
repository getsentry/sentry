from typing import Any, Dict, Union

from celery.signals import task_postrun
from django.core.signals import request_finished

from sentry.db.models.manager import M
from sentry.db.models.manager.base import BaseManager, _local_cache


class OptionManager(BaseManager[M]):
    @property
    def _option_cache(self) -> Dict[str, Dict[str, Any]]:
        if not hasattr(_local_cache, "option_cache"):
            _local_cache.option_cache = {}

        # Explicitly typing to satisfy mypy.
        option_cache: Dict[str, Dict[str, Any]] = _local_cache.option_cache
        return option_cache

    def clear_local_cache(self, **kwargs: Any) -> None:
        self._option_cache.clear()

    def contribute_to_class(self, model: M, name: str) -> None:
        super().contribute_to_class(model, name)
        task_postrun.connect(self.clear_local_cache)
        request_finished.connect(self.clear_local_cache)

    def _make_key(self, instance_id: Union[int, str]) -> str:
        assert instance_id
        return f"{self.model._meta.db_table}:{instance_id}"

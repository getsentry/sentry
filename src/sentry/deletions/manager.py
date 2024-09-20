from collections.abc import MutableMapping
from typing import Any

from sentry.db.models.base import Model
from sentry.deletions.base import BaseDeletionTask

__all__ = ["DeletionTaskManager"]


class DeletionTaskManager:
    def __init__(self, default_task: type[BaseDeletionTask[Any]] | None = None) -> None:
        self.tasks: MutableMapping[type[Model], type[BaseDeletionTask[Any]]] = {}
        self.default_task = default_task

    def exec_sync(self, instance: Model) -> None:
        task = self.get(
            model=type(instance),
            query={"id": instance.id},
        )
        while task.chunk():
            pass

    def exec_sync_many(self, instances: list[Model]) -> None:
        if not instances:
            return

        task = self.get(
            model=type(instances[0]),
            query={"id__in": [i.id for i in instances]},
        )
        while task.chunk():
            pass

    def get(
        self,
        task: type[BaseDeletionTask[Any]] | None = None,
        **kwargs: Any,
    ) -> BaseDeletionTask[Any]:
        if task is None:
            model = kwargs.get("model")
            assert model, "The model parameter is required if `task` is not provided"
            task = self.tasks.get(model, self.default_task)
        assert task is not None, "Task cannot be None"

        return task(manager=self, **kwargs)

    def register(self, model: type[Model], task: type[BaseDeletionTask[Any]]) -> None:
        self.tasks[model] = task

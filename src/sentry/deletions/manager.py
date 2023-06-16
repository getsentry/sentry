from collections import defaultdict

__all__ = ["DeletionTaskManager"]


class DeletionTaskManager:
    def __init__(self, default_task=None):
        self.tasks = {}
        self.default_task = default_task
        self.dependencies = defaultdict(set)
        self.bulk_dependencies = defaultdict(set)

    def exec_sync(self, instance):
        task = self.get(
            model=type(instance),
            query={"id": instance.id},
        )
        while task.chunk():
            pass

    def exec_sync_many(self, instances):
        if not instances:
            return

        task = self.get(
            model=type(instances[0]),
            query={"id__in": [i.id for i in instances]},
        )
        while task.chunk():
            pass

    def get(self, task=None, **kwargs):
        if task is None:
            model = kwargs.get("model")
            try:
                task = self.tasks[model]
            except KeyError:
                task = self.default_task
        return task(manager=self, **kwargs)

    def register(self, model, task):
        self.tasks[model] = task

    def add_dependencies(self, model, dependencies):
        self.dependencies[model] |= set(dependencies)

    def add_bulk_dependencies(self, model, dependencies):
        self.bulk_dependencies[model] |= set(dependencies)

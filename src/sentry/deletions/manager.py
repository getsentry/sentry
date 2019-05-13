from __future__ import absolute_import, print_function

from collections import defaultdict

__all__ = ["DeletionTaskManager"]


class DeletionTaskManager(object):
    def __init__(self, default_task=None):
        self.tasks = {}
        self.default_task = default_task
        self.dependencies = defaultdict(set)
        self.bulk_dependencies = defaultdict(set)

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

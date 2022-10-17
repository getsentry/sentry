from __future__ import annotations

import os
from collections import defaultdict
from contextlib import ExitStack, contextmanager
from typing import Any, Collection, Dict, Generator, Iterable, Set, Type

import django.apps

from sentry.db.models import BaseManager, Model
from sentry.db.models.manager.base import ModelManagerTriggerAction, ModelManagerTriggerCondition
from sentry.utils import json


class ModelManifest:
    """For auditing which models are touched by each test case."""

    class Entry:
        def __init__(self) -> None:
            self.hits: Dict[Type[Model], Set[ModelManagerTriggerCondition]] = defaultdict(set)

        def create_trigger_action(
            self, condition: ModelManagerTriggerCondition
        ) -> ModelManagerTriggerAction:
            def action(model_class: Type[Model]) -> None:
                self.hits[model_class].add(condition)

            return action

    def __init__(self, file_path: str) -> None:
        self.file_path = file_path
        self.tests: Dict[str, Collection[ModelManifest.Entry]] = {}

    def _load_json(self, content: Any) -> None:
        models = {model.__qualname__: model for model in django.apps.apps.get_models()}
        conditions = {condition.name: condition for condition in ModelManagerTriggerCondition}

        entry_objects = []

        for (test_id, entry_inputs) in content.items():
            entry_objects.append(entry_obj := ModelManifest.Entry())

            for entry_input in entry_inputs:
                for (model_name, condition_names) in entry_input.items():
                    model_class = models[model_name]
                    for condition_name in condition_names:
                        condition = conditions[condition_name]
                        entry_obj.hits[model_class].add(condition)

            self.tests[test_id] = entry_objects

    def _to_json(self) -> Dict[str, Any]:
        return {
            test_id: [
                {
                    model_class.__qualname__: [condition.name for condition in conditions]
                    for (model_class, conditions) in entry.hits.items()
                }
                for entry in entries
                if entry.hits
            ]
            for (test_id, entries) in self.tests.items()
        }

    @classmethod
    def open(cls, file_path: str) -> ModelManifest:
        manifest = cls(file_path)
        if os.path.exists(file_path):
            with open(file_path) as f:
                content = json.load(f)
            manifest._load_json(content)
        return manifest

    @contextmanager
    def write(self) -> Generator[None, None, None]:
        try:
            yield  # Populate self.tests
        finally:
            with open(self.file_path, mode="w") as f:
                json.dump(self._to_json(), f)

    @staticmethod
    def _get_all_model_managers() -> Iterable[BaseManager]:
        for model_class in django.apps.apps.get_models():
            manager = model_class.objects
            if isinstance(manager, BaseManager):
                yield manager

    @contextmanager
    def register(self, test_id: str) -> Generator[None, None, None]:
        with ExitStack() as stack:
            entries = []

            for model_manager in self._get_all_model_managers():
                entries.append(entry := ModelManifest.Entry())
                for condition in ModelManagerTriggerCondition:
                    action = entry.create_trigger_action(condition)
                    stack.enter_context(model_manager.register_trigger(condition, action))

            try:
                yield
            finally:
                # Overwrite the entire test in place, in case it used to touch a
                # model and doesn't anymore
                self.tests[test_id] = entries

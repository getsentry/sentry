from __future__ import annotations

from collections import defaultdict
from contextlib import ExitStack, contextmanager
from dataclasses import dataclass
from typing import Dict, Generator, Set, Type

import django.apps

from sentry.db.models import BaseManager, Model
from sentry.db.models.manager.base import ModelManagerTriggerCondition
from sentry.utils import json


class ModelManifest:
    """For auditing which models are touched by each test case."""

    @dataclass(frozen=True, eq=True)
    class Hit:
        model_class: Type[Model]
        condition: ModelManagerTriggerCondition

        def as_json_output(self) -> Dict[str, str]:
            return {
                "model": self.model_class.__qualname__,
                "condition": self.condition.name,
            }

    def __init__(self) -> None:
        self.hits: Dict[str, Set[ModelManifest.Hit]] = defaultdict(set)

    @contextmanager
    def open(self, file_path: str) -> Generator[None, None, None]:
        yield  # Populate self.hits

        output = {
            test_case_name: [hit.as_json_output() for hit in hit_values]
            for (test_case_name, hit_values) in self.hits.items()
        }

        with open(file_path, mode="w") as f:
            json.dump(output, f)

    @contextmanager
    def register(self, test_class_name: str) -> Generator[None, None, None]:
        with ExitStack() as stack:
            for model_class in django.apps.apps.get_models():
                if isinstance(model_class.objects, BaseManager):
                    for condition in ModelManagerTriggerCondition:

                        def action(model_class: Type[Model]) -> None:
                            self.hits[test_class_name].add(self.Hit(model_class, condition))

                        stack.enter_context(model_class.objects.register_trigger(condition, action))
            yield

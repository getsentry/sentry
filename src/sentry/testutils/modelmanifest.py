from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Dict, Set, Type

import django.apps

from sentry.db.models import BaseManager, Model
from sentry.db.models.manager.base import ModelManagerTriggerCondition, ModelManagerTriggerTeardown
from sentry.utils import json


class ModelManifest:
    """For auditing which models are touched by each test case."""

    @dataclass(frozen=True, eq=True)
    class Hit:
        model_class: Type[Model]
        condition: ModelManagerTriggerCondition

        def as_json_output(self) -> Dict[str, str]:
            return {
                "model": self.model_class.__name__,
                "condition": self.condition.name,
            }

    def __init__(self, path: str) -> None:
        if not path:
            raise ValueError
        self.path = path
        self.hits: Dict[str, Set[ModelManifest.Hit]] = defaultdict(set)

    def _set_up_model_trigger(
        self,
        test_class_name: str,
        model_manager: BaseManager,
        condition: ModelManagerTriggerCondition,
    ) -> ModelManagerTriggerTeardown:
        def action(model_class: Type[Model]) -> None:
            self.hits[test_class_name].add(self.Hit(model_class, condition))

        teardown: ModelManagerTriggerTeardown = model_manager.register_trigger(condition, action)
        return teardown

    def register(self, test_class_name: str) -> ModelManagerTriggerTeardown:
        teardown_functions = []
        for model_class in django.apps.apps.get_models():
            if isinstance(model_class.objects, BaseManager):
                for condition in ModelManagerTriggerCondition:
                    teardown_function = self._set_up_model_trigger(
                        test_class_name, model_class.objects, condition
                    )
                    teardown_functions.append(teardown_function)

        def compound_teardown() -> None:
            for teardown_function in teardown_functions:
                teardown_function()

        return compound_teardown

    def write(self) -> None:
        output = {
            test_case_name: [hit.as_json_output() for hit in hit_values]
            for (test_case_name, hit_values) in self.hits.items()
        }

        with open(self.path, mode="w") as f:
            json.dump(output, f)

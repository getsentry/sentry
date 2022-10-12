from __future__ import annotations

from collections import defaultdict
from typing import Dict, Set, Tuple, Type

import django.apps

from sentry.db.models import BaseManager, Model
from sentry.db.models.manager.base import ModelManagerTriggerCondition, ModelManagerTriggerTeardown
from sentry.utils import json


class ModelManifest:
    """For auditing which models are touched by each test case."""

    Hit = Tuple[Type[Model], ModelManagerTriggerCondition]

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
            self.hits[test_class_name].add((model_class, condition))

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
            test_case_name: [
                {
                    "model": model_class.__name__,
                    "condition": condition.name,
                }
                for (model_class, condition) in results
            ]
            for (test_case_name, results) in self.hits.items()
        }

        with open(self.path, mode="w") as f:
            json.dump(output, f)

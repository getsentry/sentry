from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import List, Optional, TypeVar

import sentry_sdk


class ModelType(Enum):
    TRANSACTIONS_REBALANCING = 1
    PROJECTS_REBALANCING = 2
    FULL_REBALANCING = 3


@dataclass
class ModelInput(ABC):
    @abstractmethod
    def validate(self) -> bool:
        # By default, we want each model value to be valid.
        return True


class InvalidModelInputError(Exception):
    pass


Input = TypeVar("Input", bound=ModelInput)
Output = TypeVar("Output")


class Model(ABC):
    def __init__(self):
        self.dependencies = {}

    @abstractmethod
    def _run(self, model_input: Input) -> Output:
        raise NotImplementedError()

    def run(self, model_input: Input) -> Output:
        if not model_input.validate():
            raise InvalidModelInputError()

        self._build_dependencies()
        return self._run(model_input)

    def guarded_run(self, model_input: Input) -> Output:
        try:
            return self.run(model_input)
        except Exception as e:
            # We want to track the error when running the model.
            sentry_sdk.capture_exception(e)
            return None

    @abstractmethod
    def _dependencies(self) -> List[ModelType]:
        return []

    def _build_dependencies(self) -> None:
        from sentry.dynamic_sampling.models.factory import model_factory

        # We don't want to compute dependencies again if we have already done it or if the list is empty.
        if len(self._dependencies()) == 0 or len(self.dependencies) > 0:
            return

        for dependency in self._dependencies():
            self.dependencies[dependency] = model_factory(dependency)

    def get_dependency(self, model_type: ModelType) -> Optional["Model"]:
        return self.dependencies.get(model_type, None)

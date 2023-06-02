from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import List, Optional, TypeVar


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

    @abstractmethod
    def _dependencies(self) -> List[ModelType]:
        return []

    def _build_dependencies(self) -> None:
        from sentry.dynamic_sampling.models.factory import model_factory

        # We don't want to compute dependencies again if we have already done it.
        if len(self._dependencies()) == 0 or len(self.dependencies) > 0:
            return

        for dependency in self._dependencies():
            self.dependencies[dependency] = model_factory(dependency)

    def get_dependency(self, model_type: ModelType) -> Optional["Model"]:
        return self.dependencies.get(model_type, None)

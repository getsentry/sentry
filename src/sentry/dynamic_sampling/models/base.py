from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Generic, Optional, TypeVar

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


class Model(ABC, Generic[Input, Output]):
    @abstractmethod
    def _run(self, model_input: Input) -> Output:
        raise NotImplementedError()

    def run(self, model_input: Input) -> Output:
        if not model_input.validate():
            raise InvalidModelInputError()

        return self._run(model_input)

    def guarded_run(self, model_input: Input) -> Optional[Output]:
        try:
            return self.run(model_input)
        except Exception as e:
            # We want to track the error when running the model.
            sentry_sdk.capture_exception(e)
            return None

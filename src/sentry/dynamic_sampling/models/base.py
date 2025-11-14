from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Generic, TypeVar, int


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

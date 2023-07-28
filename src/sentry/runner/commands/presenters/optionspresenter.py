from abc import ABC, abstractmethod
from typing import Any

"""
This class was built in support
"""


class OptionsPresenter(ABC):
    @abstractmethod
    def flush(self):
        pass

    @abstractmethod
    def set(self, key: str, value: Any):
        pass

    @abstractmethod
    def unset(self, key: str):
        pass

    @abstractmethod
    def update(self, key: str, db_value: Any, value: Any):
        pass

    @abstractmethod
    def channel_update(self, key: str):
        pass

    @abstractmethod
    def drift(self, key: str, db_value: Any):
        pass

    @abstractmethod
    def error(self, key: str, not_writable_reason: str):
        pass

    # todo: eventually add methods for invalid options, and options being set to the wrong type.

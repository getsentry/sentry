from abc import ABC, abstractmethod
from typing import Any


class OptionsPresenter(ABC):
    """
    This class defines the interface for presenting
    and communicating changes made to options in a
    system to various output channels. Only after all
    options are processed is the output presented. In other
    words, output is not written immediately, but rather all
    at once.
    """

    @abstractmethod
    def flush(self) -> None:
        """
        The method to call to flush out all output.
        """
        pass

    @abstractmethod
    def set(self, key: str, value: Any) -> None:
        pass

    @abstractmethod
    def unset(self, key: str) -> None:
        pass

    @abstractmethod
    def update(self, key: str, db_value: Any, value: Any) -> None:
        pass

    @abstractmethod
    def channel_update(self, key: str) -> None:
        pass

    @abstractmethod
    def drift(self, key: str, db_value: Any) -> None:
        pass

    @abstractmethod
    def error(self, key: str, not_writable_reason: str) -> None:
        pass

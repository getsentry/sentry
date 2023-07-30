from abc import ABC, abstractmethod
from typing import Any


class OptionsPresenter(ABC):
    """
    This class defines the interface for presenting
    and communicating changes made to options in a
    system to various output channels. It follows a
    flush approach, where changes are accumulated and
    presented as a whole after all options have been processed.
    """

    @abstractmethod
    def flush(self) -> None:
        """
        Flushes out all buffered output to the implemented
        output channel.
        """
        raise NotImplementedError

    @abstractmethod
    def set(self, key: str, value: Any) -> None:
        raise NotImplementedError

    @abstractmethod
    def unset(self, key: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def update(self, key: str, db_value: Any, value: Any) -> None:
        raise NotImplementedError

    @abstractmethod
    def channel_update(self, key: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def drift(self, key: str, db_value: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def error(self, key: str, not_writable_reason: str) -> None:
        raise NotImplementedError

from abc import ABC, abstractmethod
from typing import Any

"""
Abstract class for presenting changes to options to different channels.

This class defines the interface for presenting and communicating changes made to options in a system to various output channels.
"""


class OptionsPresenter(ABC):
    @abstractmethod
    def dry_run(self):
        pass

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

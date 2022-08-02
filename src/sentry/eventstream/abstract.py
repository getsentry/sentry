from abc import ABC, abstractmethod
from typing import Any, Literal, Mapping, Optional, Tuple, TypeVar, Union

TData = TypeVar("TData")


class EventStreamAPI(ABC):
    @abstractmethod
    def run_post_process_forwarder(
        self,
        consumer_group: str,
        commit_log_topic: str,
        synchronize_commit_group: str,
        commit_batch_size: int,
        commit_batch_timeout_ms: int,
        initial_offset_reset: Union[Literal["latest"], Literal["earliest"]],
    ) -> bool:
        raise NotImplementedError

    @abstractmethod
    def requires_post_process_forwarder(self) -> bool:
        raise NotImplementedError

    @abstractmethod
    def insert(self, data: TData) -> None:
        raise NotImplementedError


class EventStreamBackend(ABC):
    @abstractmethod
    def send(
        self,
        project_id: int,
        _type: str,
        extra_data: Tuple[Any, ...] = (),
        asynchronous: bool = True,
        headers: Optional[Mapping[str, str]] = None,
    ):
        raise NotImplementedError

    @abstractmethod
    def run_forwarder(self):
        raise NotImplementedError

    @abstractmethod
    def requires_post_process_forwarder(self) -> bool:
        raise NotImplementedError

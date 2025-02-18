from collections.abc import Callable, Mapping, MutableMapping
from dataclasses import dataclass
from datetime import datetime
from typing import Generic, TypeVar

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies import (
    CommitOffsets,
    ProcessingStrategy,
    ProcessingStrategyFactory,
)
from arroyo.types import Commit as ArroyoCommit
from arroyo.types import Message, Partition, Value


class PlatformStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):

    def __init__(self, flags: dict[str, str], runtime: "RunTime[Model, Msg]") -> None:
        self.flags = flags
        self.runtime = runtime

    def create_with_partitions(
        self,
        commit: ArroyoCommit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return PlatformStrategy(commit=commit, flags=self.flags, runtime=self.runtime)


class PlatformStrategy(ProcessingStrategy[KafkaPayload]):

    def __init__(
        self,
        commit: ArroyoCommit,
        flags: dict[str, str],
        runtime: "RunTime[Model, Msg]",
    ) -> None:
        # The RunTime is made aware of the commit strategy. It will
        # submit the partition, offset mapping it wants committed.
        runtime.setup(flags, self.handle_commit_request)

        self.__commit_step = CommitOffsets(commit)
        self.__closed = False
        self.__runtime = runtime

    def handle_commit_request(self, offsets: Mapping[Partition, int]) -> None:
        self.__commit_step.submit(Message(Value(None, offsets, datetime.now())))

    def submit(self, message: Message[KafkaPayload]) -> None:
        assert not self.__closed
        self.__runtime.submit(message)

    def poll(self) -> None:
        assert not self.__closed
        self.__commit_step.poll()

    def close(self) -> None:
        self.__closed = True
        self.__commit_step.close()

    def terminate(self) -> None:
        self.__closed = True
        self.__commit_step.terminate()

    def join(self, timeout: float | None = None) -> None:
        self.__commit_step.join(timeout)


CommitProtocol = Callable[[Mapping[Partition, int]], None]
Model = TypeVar("Model")
Msg = TypeVar("Msg")


class Cmd(Generic[Msg]):
    pass


@dataclass(frozen=True)
class BackPressure(Cmd[Msg]):
    pass


@dataclass(frozen=True)
class Commit(Cmd[Msg]):
    msg: Msg
    offsets: MutableMapping[Partition, int]


class Nothing(Cmd[Msg]):
    pass


@dataclass(frozen=True)
class Task(Cmd[Msg]):
    msg: Msg


class RunTime(Generic[Model, Msg]):

    def __init__(
        self,
        init: Callable[[dict[str, str]], tuple[Model, Cmd[Msg] | None]],
        process: Callable[[Model, bytes, Mapping[Partition, int]], Msg | None],
        subscription: Callable[[Model], Msg | None],
        update: Callable[[Model, Msg], tuple[Model, Cmd[Msg] | None]],
    ) -> None:
        self.init = init
        self.process = process
        self.subscription = subscription
        self.update = update

        self.__commit: CommitProtocol | None = None
        self.__model: Model | None = None

    @property
    def commit(self) -> CommitProtocol:
        assert self.__commit is not None
        return self.__commit

    @property
    def model(self) -> Model:
        assert self.__model is not None
        return self.__model

    def poll(self) -> None:
        self.__handle_msg(self.subscription(self.model))

    def setup(self, flags: dict[str, str], commit: CommitProtocol) -> None:
        self.__commit = commit

        model, cmd = self.init(flags)
        self.__model = model
        self.__handle_cmd(cmd)

    def submit(self, message: Message[KafkaPayload]) -> None:
        self.__handle_msg(self.process(self.model, message.payload.value, message.committable))

    def __handle_msg(self, msg: Msg | None) -> None:
        if msg:
            model, cmd = self.update(self.model, msg)
            self.__model = model
            self.__handle_cmd(cmd)

    def __handle_cmd(self, cmd: Cmd[Msg] | None) -> None:
        if cmd is None:
            return None

        match cmd:
            case BackPressure():
                # TODO
                ...
            case Commit(msg=msg, offsets=offsets):
                self.commit(offsets)
                return self.__handle_msg(msg)
            case Nothing():
                return None
            case Task(msg=msg):
                return self.__handle_msg(msg)

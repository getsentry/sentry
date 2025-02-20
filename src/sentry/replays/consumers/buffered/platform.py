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
        self.__runtime.publish("poll")
        self.__commit_step.poll()

    def close(self) -> None:
        self.__closed = True
        self.__commit_step.close()

    def terminate(self) -> None:
        self.__closed = True
        self.__commit_step.terminate()

    def join(self, timeout: float | None = None) -> None:
        self.__runtime.publish("join")
        self.__commit_step.close()
        self.__commit_step.join(timeout)


CommitProtocol = Callable[[Mapping[Partition, int]], None]
Model = TypeVar("Model")
Msg = TypeVar("Msg")


class BackPressure:
    """Instructs the RunTime to back-pressure the platform.

    Does not accept a `msg` argument as we do not expect the platform to fail.
    """

    pass


@dataclass(frozen=True)
class Commit(Generic[Msg]):
    """Instructs the RunTime to commit the platform.

    Because the RunTime is based on a Kafka platform there is an expectation that the application
    should trigger commits when necessary. While the application can't be sure its running Kafka
    it can be sure its running on a Platform that requires offsets be committed.
    """

    msg: Msg
    offsets: MutableMapping[Partition, int]


class Nothing:
    """Instructs the RunTime to do nothing. Equivalent to a null command."""

    pass


@dataclass(frozen=True)
class Task(Generic[Msg]):
    """Instructs the RunTime to emit an application message back to the application."""

    msg: Msg


# A "Cmd" is the union of all the commands an application can issue to the RunTime.
Cmd = BackPressure | Commit[Msg] | Nothing | Task[Msg]


@dataclass(frozen=True)
class Join(Generic[Msg]):
    """Join subscription class.

    The platform may need to quit. When this happens the RunTime needs to know. The application
    may or may not need to know. The Join subscription allows aplications to subscribe to join
    events and handle them in the way they see fit.
    """

    msg: Msg
    name = "join"


@dataclass(frozen=True)
class Poll(Generic[Msg]):
    """Poll subscription class.

    The platform will periodically poll the RunTime. The application may or may not subscribe to
    these events and choose to act on them.
    """

    msg: Msg
    name = "poll"


# A "Sub" is the union of all the events an application can subscribe to.
Sub = Join[Msg] | Poll[Msg]


class RunTime(Generic[Model, Msg]):

    def __init__(
        self,
        init: Callable[[dict[str, str]], tuple[Model, Cmd[Msg] | None]],
        process: Callable[[Model, bytes, Mapping[Partition, int]], Msg | None],
        subscription: Callable[[Model], list[Sub[Msg]]],
        update: Callable[[Model, Msg], tuple[Model, Cmd[Msg] | None]],
    ) -> None:
        self.init = init
        self.process = process
        self.subscription = subscription
        self.update = update

        self.__commit: CommitProtocol | None = None
        self.__model: Model | None = None
        self.__subscriptions: dict[str, Sub[Msg]] = {}

    @property
    def commit(self) -> CommitProtocol:
        assert self.__commit is not None
        return self.__commit

    @property
    def model(self) -> Model:
        assert self.__model is not None
        return self.__model

    def setup(self, flags: dict[str, str], commit: CommitProtocol) -> None:
        self.__commit = commit

        model, cmd = self.init(flags)
        self.__model = model
        self.__handle_cmd(cmd)
        self.__register_subscriptions()

    def submit(self, message: Message[KafkaPayload]) -> None:
        self.__handle_msg(self.process(self.model, message.payload.value, message.committable))

    def publish(self, sub_name: str) -> None:
        # For each new subscription event we re-register the subscribers in case anything within
        # the application has changed. I.e. the model is in some new state and that means we care
        # about a new subscription or don't care about an old one.
        self.__register_subscriptions()

        # Using the subscription's name look for the subscription in the registry.
        sub = self.__subscriptions.get(sub_name)
        if sub is None:
            return None

        # Match of the various subscription types and emit a mesasge to the RunTime. Right now
        # there's no need to match. The name disambiguates enough already but in the future more
        # subscriptions might do more complex things.
        match sub:
            case Join(msg=msg):
                return self.__handle_msg(msg)
            case Poll(msg=msg):
                return self.__handle_msg(msg)

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
                return None
            case Commit(msg=msg, offsets=offsets):
                self.commit(offsets)
                return self.__handle_msg(msg)
            case Nothing():
                return None
            case Task(msg=msg):
                return self.__handle_msg(msg)

    def __register_subscriptions(self) -> None:
        for sub in self.subscription(self.model):
            self.__subscriptions[sub.name] = sub

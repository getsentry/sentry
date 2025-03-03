from collections.abc import Callable, MutableMapping
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Generic, TypeVar, cast

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies import CommitOffsets, ProcessingStrategy
from arroyo.types import Commit as ArroyoCommit
from arroyo.types import Message, Partition, Value


class PlatformStrategy(ProcessingStrategy[KafkaPayload]):

    def __init__(
        self,
        commit: ArroyoCommit,
        flags: "Flags",
        runtime: "RunTime[Model, Msg, Flags]",
    ) -> None:
        # The RunTime is made aware of the commit strategy. It will
        # submit the partition, offset mapping it wants committed.
        runtime.setup(flags, self.handle_commit_request)

        self.__commit_step = CommitOffsets(commit)
        self.__closed = False
        self.__runtime = runtime

    def handle_commit_request(self, offsets: MutableMapping[Partition, int]) -> None:
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


CommitProtocol = Callable[[MutableMapping[Partition, int]], None]

# A Model represents the state of your application. It is a type variable and the RunTime is
# generic over it. Your state can be anything from a simple integer to a large class with many
# fields.
Model = TypeVar("Model")

# A Msg represents the commands an application can issue to itself. These commands update the state
# and optionally issue commands to the RunTime.
Msg = TypeVar("Msg")

# A generic type representing the structure of the flags passed to the RunTime instance.
Flags = TypeVar("Flags")

# A generic type of unknown origins not tied to anything in the platform.
T = TypeVar("T")


@dataclass(frozen=True)
class Commit(Generic[Msg]):
    """Instructs the RunTime to commit the message offsets."""

    msg: Msg


@dataclass(frozen=True)
class Effect(Generic[Msg]):
    """Instructs the RunTime to perform a managed effect.

    If the RunTime performs an effect for the application it means the RunTime can dictate if the
    effect blocks the application, if the effect executes at all, or perform any additional
    operations before or after the effect. This has significant implications for RunTime
    performance and application testability.
    """

    fun: Callable[[], Any]
    msg: Callable[[Any], Msg]


class Nothing:
    """Instructs the RunTime to do nothing."""


@dataclass(frozen=True)
class Task(Generic[Msg]):
    """Instructs the RunTime to emit an application message back to the application."""

    msg: Msg


# A "Cmd" is the union of all the commands an application can issue to the RunTime. The RunTime
# accepts these commands and handles them in some pre-defined way. Commands are fixed and can not
# be registered on a per application basis.
Cmd = Commit[Msg] | Effect[Msg] | Nothing | Task[Msg]


@dataclass(frozen=True)
class Join(Generic[Msg]):
    """Join subscription class.

    The platform may need to quit. When this happens the RunTime needs to know. The application
    may or may not need to know. The Join subscription allows aplications to subscribe to join
    events and handle them in the way they see fit.
    """

    msg: Callable[[], Msg]
    name = "join"


@dataclass(frozen=True)
class Poll(Generic[Msg]):
    """Poll subscription class.

    The platform will periodically poll the RunTime. The application may or may not subscribe to
    these events and choose to act on them.
    """

    msg: Callable[[], Msg]
    name = "poll"


# A "Sub" is the union of all the commands the Platform can issue to an application. The Platform
# will occassionally emit actions which are intercepted by the RunTime. The RunTime translates
# these actions into a set of predefined subscriptions. These subscriptions are exposed to the
# application and the developer is free to handle them in the way they see fit.
Sub = Join[Msg] | Poll[Msg]


class RunTime(Generic[Model, Msg, Flags]):
    """RunTime object.

    The RunTime is an intermediate data structure which manages communication between the platform
    and the application. It formalizes state transformations and abstracts the logic of the
    platform. Commands are declaratively issued rather than defined within the logic of the
    application. Commands can be issued bidirectionally with "Cmd" types flowing from the
    application to the platform and "Sub" types flowing from the platform to the application.
    """

    def __init__(
        self,
        init: Callable[[Flags], tuple[Model, Cmd[Msg]]],
        process: Callable[[Model, bytes], Msg],
        subscription: Callable[[Model], list[Sub[Msg]]],
        update: Callable[[Model, Msg], tuple[Model, Cmd[Msg]]],
    ) -> None:
        self.init = init
        self.process = process
        self.subscription = subscription
        self.update = update

        self._commit: CommitProtocol | None = None
        self._model: Model | None = None
        self._offsets: MutableMapping[Partition, int] = {}
        self._subscriptions: dict[str, Sub[Msg]] = {}

    @property
    def commit(self) -> CommitProtocol:
        assert self._commit is not None
        return self._commit

    @property
    def model(self) -> Model:
        assert self._model is not None
        return self._model

    # NOTE: Could this be a factory function that produces RunTimes instead? That way we don't need
    # the assert checks on model and commit.
    def setup(self, flags: Flags, commit: CommitProtocol) -> None:
        self._commit = commit

        model, cmd = self.init(flags)
        self._model = model
        self._handle_cmd(cmd)
        self._register_subscriptions()

    def submit(self, message: Message[KafkaPayload]) -> None:
        self._handle_msg(self.process(self.model, message.payload.value))
        self._offsets = cast(MutableMapping[Partition, int], message.committable)

    def publish(self, sub_name: str) -> None:
        # For each new subscription event we re-register the subscribers in case anything within
        # the application has changed. I.e. the model is in some new state and that means we care
        # about a new subscription or don't care about an old one.
        self._register_subscriptions()

        # Using the subscription's name look for the subscription in the registry.
        sub = self._subscriptions.get(sub_name)
        if sub is None:
            return None

        # Match of the various subscription types and emit a mesasge to the RunTime. Right now
        # there's no need to match. The name disambiguates enough already but in the future more
        # subscriptions might do more complex things.
        match sub:
            case Join(msg=msg):
                return self._handle_msg(msg())
            case Poll(msg=msg):
                return self._handle_msg(msg())

    def _handle_msg(self, msg: Msg) -> None:
        model, cmd = self.update(self.model, msg)
        self._model = model
        self._handle_cmd(cmd)

    def _handle_cmd(self, cmd: Cmd[Msg]) -> None:
        match cmd:
            case Commit(msg=msg):
                self.commit(self._offsets)
                return self._handle_msg(msg)
            case Effect(msg=msg, fun=fun):
                return self._handle_msg(msg(fun()))
            case Nothing():
                return None
            case Task(msg=msg):
                return self._handle_msg(msg)

    def _register_subscriptions(self) -> None:
        for sub in self.subscription(self.model):
            self._subscriptions[sub.name] = sub

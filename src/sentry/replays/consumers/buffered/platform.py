from collections.abc import Callable, MutableMapping
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Generic, TypeVar

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies import MessageRejected, ProcessingStrategy
from arroyo.types import FilteredPayload, Message, Partition, Value

Out = TypeVar("Out")
Input = FilteredPayload | KafkaPayload


class PlatformStrategy(ProcessingStrategy[Input], Generic[Out]):

    def __init__(
        self,
        flags: "Flags",
        runtime: "RunTime[Model, Msg, Flags, Out]",
        next_step: "ProcessingStrategy[Out]",
    ) -> None:
        # The RunTime is made aware of the commit strategy. It will
        # submit the partition, offset mapping it wants committed.
        runtime.setup(flags, self._handle_next_step)

        self.__closed = False
        self.__next_step = next_step
        self.__offsets: MutableMapping[Partition, int] = {}
        self.__runtime = runtime

    # NOTE: Filtered payloads update the offsets but are not forwarded to the next step. My
    # concern is that the filtered payload could have its offsets committed before the
    # preceeding messages have their offsets committed. This is against what the Arroyo library
    # does which is to forward everything.
    def submit(self, message: Message[FilteredPayload | KafkaPayload]) -> None:
        assert not self.__closed

        if isinstance(message.payload, KafkaPayload):
            self.__runtime.submit(message.payload.value)
            self.__offsets.update(message.committable)
        else:
            self.__offsets.update(message.committable)

    def poll(self) -> None:
        assert not self.__closed

        try:
            self.__runtime.publish("poll")
        except MessageRejected:
            pass

        self.__next_step.poll()

    def close(self) -> None:
        self.__closed = True

    def terminate(self) -> None:
        self.__closed = True
        self.__next_step.terminate()

    def join(self, timeout: float | None = None) -> None:
        try:
            self.__runtime.publish("join")
        except MessageRejected:
            pass

        self.__next_step.close()
        self.__next_step.join(timeout)

    def _handle_next_step(self, value: Out) -> None:
        self.__next_step.submit(Message(Value(value, self.__offsets, datetime.now())))


# A Model represents the state of your application. It is a type variable and the RunTime is
# generic over it. Your state can be anything from a simple integer to a large class with many
# fields.
Model = TypeVar("Model")

# A Msg represents the commands an application can issue to itself. These commands update the state
# and optionally issue commands to the RunTime.
Msg = TypeVar("Msg")

# A generic type representing the structure of the flags passed to the RunTime instance.
Flags = TypeVar("Flags")


@dataclass(frozen=True)
class NextStep(Generic[Msg, Out]):
    """Instructs the RunTime to produce to the next step."""

    msg: Msg
    value: Out


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
Cmd = NextStep[Msg, Out] | Effect[Msg] | Nothing | Task[Msg]


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


class RunTime(Generic[Model, Msg, Flags, Out]):
    """RunTime object.

    The RunTime is an intermediate data structure which manages communication between the platform
    and the application. It formalizes state transformations and abstracts the logic of the
    platform. Commands are declaratively issued rather than defined within the logic of the
    application. Commands can be issued bidirectionally with "Cmd" types flowing from the
    application to the platform and "Sub" types flowing from the platform to the application.
    """

    def __init__(
        self,
        init: Callable[[Flags], tuple[Model, Cmd[Msg, Out]]],
        process: Callable[[Model, bytes], Msg],
        subscription: Callable[[Model], list[Sub[Msg]]],
        update: Callable[[Model, Msg], tuple[Model, Cmd[Msg, Out]]],
    ) -> None:
        self.init = init
        self.process = process
        self.subscription = subscription
        self.update = update

        self._next_step: Callable[[Out], None] | None = None
        self._model: Model | None = None
        self._subscriptions: dict[str, Sub[Msg]] = {}

    @property
    def model(self) -> Model:
        assert self._model is not None
        return self._model

    @property
    def next_step(self) -> Callable[[Out], None]:
        assert self._next_step is not None
        return self._next_step

    # NOTE: Could this be a factory function that produces RunTimes instead? That way we don't need
    # the assert checks on model and commit.
    def setup(self, flags: Flags, next_step: Callable[[Out], None]) -> None:
        self._next_step = next_step

        model, cmd = self.init(flags)
        self._model = model
        self._handle_cmd(cmd)
        self._register_subscriptions()

    def submit(self, message: bytes) -> None:
        self._handle_msg(self.process(self.model, message))

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

    def _handle_cmd(self, cmd: Cmd[Msg, Out]) -> None:
        match cmd:
            case NextStep(msg=msg, value=value):
                self.next_step(value)
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

"""Buffered RunTime implementation.

The Buffering RunTime eagerly processes messages as they are received and waits until its buffer
is full before flushing those messages. The goal being to achieve efficiencies from batched I/O.
"""

from collections.abc import Callable, MutableMapping
from dataclasses import dataclass
from functools import partial
from typing import Generic, TypeVar

from arroyo.types import Partition

from sentry.replays.consumers.buffered.platform import (
    Cmd,
    Commit,
    Flags,
    Join,
    Nothing,
    Poll,
    RunTime,
    Sub,
    Task,
)

Item = TypeVar("Item")
T = TypeVar("T")


@dataclass
class Model(Generic[Item]):
    buffer: list[Item]
    can_flush: Callable[["Model[Item]"], bool]
    do_flush: Callable[["Model[Item]"], None]
    offsets: MutableMapping[Partition, int]


@dataclass(frozen=True)
class Append(Generic[Item]):
    """Append the item to the buffer and update the offsets."""

    item: Item
    offset: MutableMapping[Partition, int]


@dataclass(frozen=True)
class AppendOffset:
    offset: MutableMapping[Partition, int]


class Committed:
    """The platform committed offsets. Our buffer is now completely done."""

    pass


class Flush:
    """Our application hit the flush threshold and has been instructed to flush."""

    pass


class Polled:
    """Our application was polled by the platform."""

    pass


class TryFlush:
    pass


# A "Msg" is the union of all application messages our RunTime will accept.
Msg = Append[Item] | AppendOffset | Committed | Flush | Polled | TryFlush


def process(
    process_fn: Callable[[bytes], Item | None],
    model: Model[Item],
    message: bytes,
    offset: MutableMapping[Partition, int],
) -> Msg[Item]:
    item = process_fn(message)
    if item:
        return Append(item=item, offset=offset)
    else:
        return AppendOffset(offset=offset)


def init(
    init_fn: Callable[[Flags], Model[Item]],
    flags: Flags,
) -> tuple[Model[Item], Cmd[Msg[Item]]]:
    return (init_fn(flags), Nothing())


def update(model: Model[Item], msg: Msg[Item]) -> tuple[Model[Item], Cmd[Msg[Item]] | None]:
    match msg:
        case Append(item=item, offset=offset):
            model.buffer.append(item)
            model.offsets.update(offset)
            return (model, Task(msg=TryFlush()))
        case AppendOffset(offset=offset):
            model.offsets.update(offset)
            return (model, Task(msg=TryFlush()))
        case Committed():
            return (model, None)
        case Flush():
            model.do_flush(model)
            model.buffer = []
            return (model, Commit(msg=Committed(), offsets=model.offsets))
        case Polled():
            if model.can_flush(model):
                return (model, Task(msg=Flush()))
            else:
                return (model, None)
        case TryFlush():
            if model.can_flush(model):
                return (model, Task(msg=Flush()))
            else:
                return (model, None)


def subscription(model: Model[Item]) -> list[Sub[Msg[Item]]]:
    return [
        Join(msg=Flush()),
        Poll(msg=Polled()),
    ]


def buffering_runtime(
    init_fn: Callable[[Flags], Model[Item]],
    process_fn: Callable[[bytes], Item | None],
) -> RunTime[Model[Item], Msg[Item], Flags]:
    return RunTime(
        init=partial(init, init_fn),
        process=partial(process, process_fn),
        subscription=subscription,
        update=update,
    )

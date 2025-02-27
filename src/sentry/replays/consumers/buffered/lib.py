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


class Committed:
    """The platform committed offsets. Our buffer is now completely done."""

    pass


class Flush:
    """Our application hit the flush threshold and has been instructed to flush."""

    pass


class Polled:
    """Our application was polled by the platform."""

    pass


# A "Msg" is the union of all application messages our RunTime will accept.
Msg = Append[Item] | Committed | Flush | Polled


def process(
    process_fn: Callable[[bytes], Item | None],
    model: Model[Item],
    message: bytes,
    offset: MutableMapping[Partition, int],
) -> Msg[Item] | None:
    item = process_fn(message)
    if item:
        return Append(item=item, offset=offset)
    else:
        return None


def init(
    init_fn: Callable[[dict[str, str]], Model[Item]],
    flags: dict[str, str],
) -> tuple[Model[Item], Cmd[Msg[Item]]]:
    return (init_fn(flags), Nothing())


def update(model: Model[Item], msg: Msg[Item]) -> tuple[Model[Item], Cmd[Msg[Item]] | None]:
    match msg:
        case Append(item=item, offset=offset):
            model.buffer.append(item)
            model.offsets.update(offset)
            if model.can_flush(model):
                return (model, Task(msg=Flush()))
            else:
                return (model, None)
        case Flush():
            # What should happen if we fail? If you raise an exception the platform will restart
            # from the last checkpoint -- which is standard behavior. We could be more clever here
            # and provide error handling facilities or we could accept that this problem gets too
            # complicated to reasonably abstract and have developers implement their own buffering
            # consumer.
            model.do_flush(model)
            model.buffer = []
            return (model, Commit(msg=Committed(), offsets=model.offsets))
        case Committed():
            return (model, None)
        case Polled():
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
    init_fn: Callable[[dict[str, str]], Model[Item]],
    process_fn: Callable[[bytes], Item | None],
) -> RunTime[Model[Item], Msg[Item]]:
    return RunTime(
        init=partial(init, init_fn),
        process=partial(process, process_fn),
        subscription=subscription,
        update=update,
    )

"""Buffered RunTime implementation."""

from collections.abc import Callable, MutableMapping
from dataclasses import dataclass
from functools import partial
from typing import Generic, TypeVar

from arroyo.types import Partition

from sentry.replays.consumers.buffered.platform import Cmd, Commit, Nothing, RunTime, Task

Item = TypeVar("Item")
T = TypeVar("T")


@dataclass
class Model(Generic[Item]):
    buffer: list[Item]
    can_flush: Callable[["Model[Item]"], bool]
    do_flush: Callable[["Model[Item]"], None]
    offsets: MutableMapping[Partition, int]


class Msg(Generic[Item]):
    pass


@dataclass(frozen=True)
class Append(Msg[Item]):
    item: Item
    offset: MutableMapping[Partition, int]


class Committed(Msg[Item]):
    pass


class Flush(Msg[Item]):
    pass


def process(
    process_fn: Callable[[bytes], Item | None],
    model: Model[Item],
    message: bytes,
    offset: MutableMapping[Partition, int],
) -> Msg[Item] | None:
    item = process_fn(message)
    if item:
        return Append(item=item, offset=offset)


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
            if model.can_flush():
                return (model, Task(msg=Flush()))
            else:
                return (model, None)
        case Flush():
            # What should happen if we fail? If you raise an exception the platform will restart
            # from the last checkpoint -- which is standard behavior. We could be more clever here
            # and provide error handling facilities or we could accept that this problem gets too
            # complicated to reasonably abstract and have developers implement their own buffering
            # consumer.
            model.do_flush()
            model.buffer = []
            return (model, Commit(msg=Committed(), offsets=model.offsets))
        case Committed():
            return (model, None)

    # Satisfy mypy. Apparently we don't do exhaustiveness checks in our configuration.
    return (model, None)


def subscription(model: Model[Item]) -> Msg[Item] | None:
    if model.can_flush():
        return Flush()
    else:
        return None


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

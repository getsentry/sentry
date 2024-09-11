# Thread safe flag tracking wrapper.
from contextvars import ContextVar

flag_manager = ContextVar("flag_manager")  # type: ignore[var-annotated]


def initialize_flag_manager(capacity: int = 10) -> None:
    flag_manager.set(FlagManager(capacity=capacity))


# NOTE: If not properly initialized this function is a no-op.
def process_flag_result(flag: str, result: bool) -> None:
    try:
        _flag_manager = flag_manager.get()
        _flag_manager.insert(flag, result)
    except LookupError:
        return None


# NOTE: If not properly initialized this function is a no-op.
def get_flags_serialized():
    try:
        _flag_manager = flag_manager.get()
        return _flag_manager.serialize()
    except LookupError:
        return []


# Flag tracking implementation.
import itertools
from typing import TypedDict


class SerializedFlag(TypedDict):
    flag: str
    result: bool


class Flag:
    __slots__ = ("flag", "result")

    def __init__(self, flag: str, result: bool) -> None:
        self.flag = flag
        self.result = result

    @property
    def asdict(self) -> SerializedFlag:
        return {"flag": self.flag, "result": self.result}


class FlagManager:
    # NOTE: Implemented using a ciruclar buffer instead an LRU for ease
    # of implementation.

    def __init__(self, capacity: int) -> None:
        assert capacity > 0
        self.buffer: list[Flag] = []
        self.capacity = capacity
        self.ip = 0

    @property
    def index(self):
        return self.ip % self.capacity

    def insert(self, flag: str, result: bool) -> None:
        flag_ = Flag(flag, result)

        if self.ip >= self.capacity:
            self.buffer[self.index] = flag_
        else:
            self.buffer.append(flag_)

        self.ip += 1

    def serialize(self) -> list[SerializedFlag]:
        if self.ip >= self.capacity:
            iterator = itertools.chain(range(self.index, self.capacity), range(0, self.index))
            return [self.buffer[i].asdict for i in iterator]
        else:
            return [flag.asdict for flag in self.buffer]

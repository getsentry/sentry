from collections.abc import Hashable, Iterator, MutableMapping
from typing import TypeVar, overload

__unset__ = object()

KT = TypeVar("KT", bound=Hashable)
VT = TypeVar("VT", bound=Hashable)
DT = TypeVar("DT")


class BidirectionalMapping(MutableMapping[KT, VT]):
    """\
    An associative data structure in which the ``(key, value)`` pairs form a
    one-to-one correspondence in both directions.

    For example, when ``(a, b)`` is added to the mapping, ``b`` can be found
    when ``a`` is used as a key, and ``a`` can *also* be found when ``b`` is
    provided to ``get_key``.
    """

    def __init__(self, data: MutableMapping[KT, VT]) -> None:
        self.__data = data
        self.__inverse: dict[object, KT] = {v: k for k, v in self.__data.items()}
        if len(self.__data) != len(self.__inverse):
            raise ValueError("duplicate value provided")

    def __getitem__(self, key: KT) -> VT:
        return self.__data[key]

    def __setitem__(self, key: KT, value: VT) -> None:
        if not isinstance(key, Hashable):
            raise TypeError("key must be hashable")

        if not isinstance(value, Hashable):
            raise TypeError("value must be hashable")

        if value in self.__inverse:
            raise ValueError("value already present")

        previous = self.__data.pop(key, __unset__)
        if previous is not __unset__:
            assert self.__inverse.pop(previous) == key

        self.__data[key] = value
        self.__inverse[value] = key

    def __delitem__(self, key: KT) -> None:
        del self.__inverse[self.__data.pop(key)]

    def __iter__(self) -> Iterator[KT]:
        return iter(self.__data)

    def __len__(self) -> int:
        return len(self.__data)

    @overload
    def get_key(self, value: object) -> KT: ...

    @overload
    def get_key(self, value: object, default: DT) -> KT | DT: ...

    def get_key(self, value: object, default: object = __unset__) -> object:
        try:
            return self.__inverse[value]
        except KeyError:
            if default is __unset__:
                raise
            else:
                return default

    def inverse(self) -> dict[object, KT]:
        return self.__inverse.copy()

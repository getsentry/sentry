from typing import TypeVar

# This is meant to be a base type from which we can derive types useful when we have what is in
# spirit a dictionary but is in practice a list of tuples. For example:
#     KeyedInts = KeyedList[int]
#     some_ints: KeyedInts = [("one", 1), ("two", 2)]
T = TypeVar("T")
KeyedList = list[tuple[str, T]]

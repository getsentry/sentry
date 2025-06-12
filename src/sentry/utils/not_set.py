from __future__ import annotations

from enum import Enum, auto
from typing import TypeVar


class NotSet(Enum):
    TOKEN = auto()


NOT_SET = NotSet.TOKEN

T = TypeVar("T")


def default_if_not_set(default: T, value: T | NotSet) -> T:
    """
    Used for optionally passing parameters to a function, and defaulting to some value if not passed.
    This is useful for updating fields on a model, since we can't set those defaults on the function level.
    Example usage:
    def my_updater(my_model: SomeModel, val_a: str | NotSet = NOT_SET):
        my_model.some_field = default_if_not_set(my_model.some_field, val_a)
        my_model.save()
    """
    if value is NOT_SET:
        return default
    return value

from collections.abc import Sequence

from rest_framework.exceptions import ValidationError

from sentry.api.exceptions import ResourceDoesNotExist
from sentry.db.models.fields.bounded import BoundedBigAutoField


def to_valid_int_id(name: str, val: str | int, raise_404: bool = False) -> int:
    """
    Convert a string or integer to a valid integer id.
    Raises a ValidationError if the value is not a valid integer id.
    If raise_404 is True, raises ResourceDoesNotExist instead.
    NOTE: This function is no stricter than int(); if the annotated types
    aren't honored (eg passing in a float or bool), an int may still be returned.
    """
    ival: int
    if isinstance(val, int):
        ival = val
    else:
        try:
            ival = int(val)
        except ValueError:
            if raise_404:
                raise ResourceDoesNotExist
            raise ValidationError({name: f"Value {val} is not a valid integer id"})
    if ival >= 0 and ival <= BoundedBigAutoField.MAX_VALUE:
        return ival
    if raise_404:
        raise ResourceDoesNotExist
    raise ValidationError({name: f"Value {val} is not a valid integer id"})


def to_valid_int_id_list(name: str, val: Sequence[str | int]) -> list[int]:
    """
    Convert a sequence of strings or integers to a list of valid integer ids.
    Raises a ValidationError if any of the values are not a valid integer id.
    """
    return [to_valid_int_id(name, v) for v in val]

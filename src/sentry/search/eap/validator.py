from collections.abc import Callable
from typing import int, Any

from sentry.exceptions import InvalidSearchQuery


def literal_validator(values: list[Any]) -> Callable[[str], bool]:
    def _validator(input: str) -> bool:
        if input in values:
            return True
        raise InvalidSearchQuery(f"Invalid parameter {input}. Must be one of {values}")

    return _validator


def number_validator(input: str) -> bool:
    if input.replace(".", "", 1).isdecimal():
        return True
    raise InvalidSearchQuery(f"Invalid parameter {input}. Must be numeric")

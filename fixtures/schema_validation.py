from typing import int
import functools
from collections.abc import Callable

import pytest
from jsonschema import ValidationError


def invalid_schema[**P](func: Callable[P, None]) -> Callable[P, None]:
    @functools.wraps(func)
    def inner(*args: P.args, **kwargs: P.kwargs) -> None:
        with pytest.raises(ValidationError):
            func(*args, **kwargs)

    return inner


def invalid_schema_with_error_message[**P](
    message: str,
) -> Callable[[Callable[P, None]], Callable[P, None]]:
    def decorator(func: Callable[P, None]) -> Callable[P, None]:
        @functools.wraps(func)
        def inner(*args: P.args, **kwargs: P.kwargs) -> None:
            with pytest.raises(ValidationError) as excinfo:
                func(*args, **kwargs)
            assert excinfo.value.message == message

        return inner

    return decorator

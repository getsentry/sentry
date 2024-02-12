from __future__ import annotations

from collections.abc import Callable
from typing import ParamSpec, TypeVar

# TODO: Once we're on python 3.12, we can get rid of these and change the first line of the
# signature of `capture_return_values` to
#   def capture_return_values[T, **P](
P = ParamSpec("P")
T = TypeVar("T")


def capture_return_values(
    fn: Callable[P, T],
    return_values: list[T] | dict[str, list[T]],
) -> Callable[P, T]:
    """
    Create a wrapped version of the given function, which stores the return value each time that
    function is called. This is useful when you want to spy on a given function and make assertions
    based on what it returns.

    In a test, this can be used in concert with a patching context manager like so:

        from unittest import mock
        from wherever import capture_return_values
        from animals import get_dog, get_cat

        def test_getting_animals():
            # If you're only planning to patch one function, use a list:

            get_dog_return_values = []
            wrapped_get_dog = capture_return_values(
                get_dog, get_dog_return_values
            )

            with mock.patch(
                "animals.get_dog", wraps=wrapped_get_dog
            ) as get_dog_spy:
                a_function_that_calls_get_dog()
                assert get_dog_spy.call_count == 1
                assert get_dog_return_values[0] == "maisey"

            # Alternatively, if you're planning to patch more than one function,
            # you can pass a dictionary:

            return_values = {}
            wrapped_get_dog = capture_return_values(
                get_dog, return_values
            )
            wrapped_get_cat = capture_return_values(
                get_cat, return_values
            )

            with(
                mock.patch(
                    "animals.get_dog", wraps=wrapped_get_dog
                ) as get_dog_spy,
                mock.patch(
                    "animals.get_cat", wraps=wrapped_get_cat
                ) as get_cat_spy,
            ):
                a_function_that_calls_get_dog()
                assert get_dog_spy.call_count == 1
                assert return_values["get_dog"][0] == "charlie"

                a_function_that_calls_get_cat()
                assert get_cat_spy.call_count == 1
                assert return_values["get_cat"][0] == "piper"
    """

    def wrapped_fn(*args: P.args, **kwargs: P.kwargs) -> T:
        returned_value = fn(*args, **kwargs)

        if isinstance(return_values, list):
            return_values.append(returned_value)
        elif isinstance(return_values, dict):
            return_values.setdefault(fn.__name__, []).append(returned_value)

        return returned_value

    return wrapped_fn

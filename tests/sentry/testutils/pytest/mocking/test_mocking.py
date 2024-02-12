from typing import Any
from unittest import TestCase, mock

from sentry.testutils.pytest.mocking import capture_return_values
from tests.sentry.testutils.pytest.mocking.animals import (
    a_function_that_calls_get_cat,
    a_function_that_calls_get_dog,
    get_cat,
    get_dog,
)


class CaptureReturnValuesTest(TestCase):
    def test_return_values_as_list(self):
        get_dog_return_values: list[Any] = []

        wrapped_get_dog = capture_return_values(get_dog, get_dog_return_values)

        with mock.patch(
            "tests.sentry.testutils.pytest.mocking.animals.get_dog",
            wraps=wrapped_get_dog,
        ) as get_dog_spy:
            a_function_that_calls_get_dog()
            assert get_dog_spy.call_count == 1
            assert get_dog_return_values[0] == "maisey"

    def test_return_values_as_dict(self):
        return_values: dict[str, list[Any]] = {}

        wrapped_get_dog = capture_return_values(get_dog, return_values)
        wrapped_get_cat = capture_return_values(get_cat, return_values)

        with (
            mock.patch(
                "tests.sentry.testutils.pytest.mocking.animals.get_dog",
                wraps=wrapped_get_dog,
            ) as get_dog_spy,
            mock.patch(
                "tests.sentry.testutils.pytest.mocking.animals.get_cat",
                wraps=wrapped_get_cat,
            ) as get_cat_spy,
        ):
            a_function_that_calls_get_dog()
            assert get_dog_spy.call_count == 1
            assert return_values["get_dog"][0] == "maisey"

            a_function_that_calls_get_cat()
            assert get_cat_spy.call_count == 1
            assert return_values["get_cat"][0] == "piper"

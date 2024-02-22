from typing import Any
from unittest import TestCase, mock

from sentry.testutils.pytest.mocking import capture_results
from tests.sentry.testutils.pytest.mocking.animals import (
    a_function_that_calls_erroring_get_dog,
    a_function_that_calls_get_cat,
    a_function_that_calls_get_dog,
    erroring_get_dog,
    get_cat,
    get_dog,
)


class CaptureReturnValuesTest(TestCase):
    def test_return_values_as_list(self):
        get_dog_return_values: list[Any] = []

        wrapped_get_dog = capture_results(get_dog, get_dog_return_values)

        with mock.patch(
            "tests.sentry.testutils.pytest.mocking.animals.get_dog",
            wraps=wrapped_get_dog,
        ) as get_dog_spy:
            a_function_that_calls_get_dog()
            assert get_dog_spy.call_count == 1
            assert get_dog_return_values[0] == "maisey"

    def test_return_values_as_dict(self):
        return_values: dict[str, list[Any]] = {}

        wrapped_get_dog = capture_results(get_dog, return_values)
        wrapped_get_cat = capture_results(get_cat, return_values)

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

    def test_records_thrown_exception(self):
        erroring_get_dog_results: list[Any] = []

        wrapped_erroring_get_dog = capture_results(erroring_get_dog, erroring_get_dog_results)

        with mock.patch(
            "tests.sentry.testutils.pytest.mocking.animals.erroring_get_dog",
            wraps=wrapped_erroring_get_dog,
        ) as erroring_get_dog_spy:
            a_function_that_calls_erroring_get_dog()

            assert erroring_get_dog_spy.call_count == 1

            result = erroring_get_dog_results[0]
            assert isinstance(result, TypeError)

            error_message = result.args[0]
            assert error_message == "Expected dog, but got cat instead."

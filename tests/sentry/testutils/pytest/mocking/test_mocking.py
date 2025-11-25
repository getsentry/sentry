from typing import Any
from unittest import TestCase, mock
from unittest.mock import MagicMock

from sentry.testutils.pytest.mocking import capture_results, count_matching_calls
from tests.sentry.testutils.pytest.mocking.animals import (
    a_function_that_calls_erroring_get_dog,
    a_function_that_calls_get_cat,
    a_function_that_calls_get_dog,
    erroring_get_dog,
    get_cat,
    get_dog,
)


class CaptureReturnValuesTest(TestCase):
    def test_return_values_as_list(self) -> None:
        get_dog_return_values: list[Any] = []

        wrapped_get_dog = capture_results(get_dog, get_dog_return_values)

        with mock.patch(
            "tests.sentry.testutils.pytest.mocking.animals.get_dog",
            wraps=wrapped_get_dog,
        ) as get_dog_spy:
            a_function_that_calls_get_dog()
            assert get_dog_spy.call_count == 1
            assert get_dog_return_values[0] == "maisey"

    def test_return_values_as_dict(self) -> None:
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

    def test_records_thrown_exception(self) -> None:
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


class MockCallCountingTest(TestCase):
    def test_no_args_no_kwargs_matching(self) -> None:
        describe_dogs = MagicMock()
        # Call the function more than once to show it's not just the total number of calls being
        # counted, and call it with something else second, to show it's not just looking at the most
        # recent call
        describe_dogs()
        describe_dogs("maisey")

        assert count_matching_calls(describe_dogs) == 1

    def test_arg_matching(self) -> None:
        describe_dogs = MagicMock()
        describe_dogs("maisey")
        describe_dogs("charlie")
        describe_dogs("maisey")
        describe_dogs("maisey", "charlie")

        assert count_matching_calls(describe_dogs, "maisey") == 2
        assert count_matching_calls(describe_dogs, "charlie") == 1
        assert count_matching_calls(describe_dogs, "maisey", "charlie") == 1

    def test_kwarg_matching(self) -> None:
        describe_dogs = MagicMock()
        describe_dogs(number_1_dog="maisey")
        describe_dogs(number_1_dog="charlie")
        describe_dogs(number_1_dog="maisey")
        describe_dogs(numer_1_dog="maisey", co_number_1_dog="charlie")

        assert count_matching_calls(describe_dogs, number_1_dog="maisey") == 2
        assert count_matching_calls(describe_dogs, number_1_dog="charlie") == 1
        assert (
            count_matching_calls(describe_dogs, numer_1_dog="maisey", co_number_1_dog="charlie")
            == 1
        )

    def test_mixed_matching(self) -> None:
        describe_dogs = MagicMock()
        describe_dogs("maisey", is_number_1_dog=True)
        describe_dogs("charlie", is_number_1_dog=True)
        describe_dogs("maisey", is_number_1_dog=True)
        describe_dogs("maisey", "charlie", co_number_1_dogs=True)

        assert count_matching_calls(describe_dogs, "maisey", is_number_1_dog=True) == 2
        assert count_matching_calls(describe_dogs, "charlie", is_number_1_dog=True) == 1
        assert count_matching_calls(describe_dogs, "maisey", "charlie", co_number_1_dogs=True) == 1

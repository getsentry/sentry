import datetime
import unittest
from unittest.mock import MagicMock, patch

import pytest
from django.db import OperationalError
from django.utils import timezone
from rest_framework.exceptions import APIException, Throttled, ValidationError
from sentry_sdk import Scope

from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.utils import (
    MAX_STATS_PERIOD,
    clamp_date_range,
    get_date_range_from_params,
    handle_query_errors,
    print_and_capture_handler_exception,
    to_valid_int_id,
    to_valid_int_id_list,
)
from sentry.db.models.fields.bounded import BoundedBigAutoField
from sentry.exceptions import IncompatibleMetricsQuery, InvalidParams, InvalidSearchQuery
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils.snuba import (
    DatasetSelectionError,
    QueryConnectionFailed,
    QueryExecutionError,
    QueryExecutionTimeMaximum,
    QueryIllegalTypeOfArgument,
    QueryMemoryLimitExceeded,
    QueryMissingColumn,
    QueryOutsideRetentionError,
    QuerySizeExceeded,
    QueryTooManySimultaneous,
    SchemaValidationError,
    SnubaError,
    UnqualifiedQueryError,
)
from sentry.utils.snuba_rpc import SnubaRPCTooManySimultaneous


class GetDateRangeFromParamsTest(unittest.TestCase):
    def test_timeframe(self) -> None:
        start, end = get_date_range_from_params({"timeframe": "14h"})
        assert end - datetime.timedelta(hours=14) == start

        start, end = get_date_range_from_params({"timeframe": "14d"})
        assert end - datetime.timedelta(days=14) == start

        start, end = get_date_range_from_params({"timeframe": "60m"})
        assert end - datetime.timedelta(minutes=60) == start

        start, end = get_date_range_from_params({"timeframe": "3600s"})
        assert end - datetime.timedelta(seconds=3600) == start

        start, end = get_date_range_from_params({"timeframe": "91d"})
        assert end - datetime.timedelta(days=91) == start

        start, end = get_date_range_from_params({"statsPeriod": "14h"})
        assert end - datetime.timedelta(hours=14) == start

        start, end = get_date_range_from_params({"statsPeriod": "14d"})
        assert end - datetime.timedelta(days=14) == start

        start, end = get_date_range_from_params({"statsPeriod": "60m"})
        assert end - datetime.timedelta(minutes=60) == start

        with pytest.raises(InvalidParams):
            get_date_range_from_params({"timeframe": "9000000d"})

    def test_date_range(self) -> None:
        start, end = get_date_range_from_params({"start": "2018-11-01", "end": "2018-11-07"})

        assert start == datetime.datetime(2018, 11, 1, tzinfo=datetime.UTC)
        assert end == datetime.datetime(2018, 11, 7, tzinfo=datetime.UTC)

        with pytest.raises(InvalidParams):
            get_date_range_from_params(
                {"start": "2018-11-01T00:00:00", "end": "2018-11-01T00:00:00"}
            )

    @freeze_time("2018-12-11 03:21:34")
    def test_no_params(self) -> None:
        start, end = get_date_range_from_params({})
        assert start == timezone.now() - MAX_STATS_PERIOD
        assert end == timezone.now()

    @freeze_time("2018-12-11 03:21:34")
    def test_no_params_optional(self) -> None:
        start, end = get_date_range_from_params({}, optional=True)
        assert start is None
        assert end is None

    @freeze_time("2018-12-11 03:21:34")
    def test_relative_date_range(self) -> None:
        start, end = get_date_range_from_params({"timeframeStart": "14d", "timeframeEnd": "7d"})

        assert start == datetime.datetime(2018, 11, 27, 3, 21, 34, tzinfo=datetime.UTC)
        assert end == datetime.datetime(2018, 12, 4, 3, 21, 34, tzinfo=datetime.UTC)

        start, end = get_date_range_from_params({"statsPeriodStart": "14d", "statsPeriodEnd": "7d"})

        assert start == datetime.datetime(2018, 11, 27, 3, 21, 34, tzinfo=datetime.UTC)
        assert end == datetime.datetime(2018, 12, 4, 3, 21, 34, tzinfo=datetime.UTC)

    @freeze_time("2018-12-11 03:21:34")
    def test_relative_date_range_incomplete(self) -> None:
        with pytest.raises(InvalidParams):
            start, end = get_date_range_from_params({"timeframeStart": "14d"})


class PrintAndCaptureHandlerExceptionTest(APITestCase):
    def setUp(self) -> None:
        self.handler_error = Exception("nope")

    @patch("sys.stderr.write")
    def test_logs_error_locally(self, mock_stderr_write: MagicMock) -> None:
        try:
            raise self.handler_error
        except Exception as e:
            print_and_capture_handler_exception(e)

        (((s,), _),) = mock_stderr_write.call_args_list
        assert s.splitlines()[-1] == "Exception: nope"

    @patch("sentry.api.utils.capture_exception")
    def test_passes_along_exception(
        self,
        mock_capture_exception: MagicMock,
    ) -> None:
        print_and_capture_handler_exception(self.handler_error)

        assert mock_capture_exception.call_args.args[0] == self.handler_error

    @patch("sentry.api.utils.capture_exception")
    def test_merges_handler_context_with_scope(
        self,
        mock_capture_exception: MagicMock,
    ) -> None:
        handler_context = {"api_request_URL": "http://dogs.are.great/"}
        scope = Scope()
        tags = {"maisey": "silly", "charlie": "goofy"}
        for tag, value in tags.items():
            scope.set_tag(tag, value)

        cases = [
            # The first half of each tuple is what's passed to
            # `print_and_capture_handler_exception`, and the second half is what we expect in the
            # scope passed to `capture_exception`
            (None, None, {}, {}),
            (handler_context, None, {"Request Handler Data": handler_context}, {}),
            (None, scope, {}, tags),
            (
                handler_context,
                scope,
                {"Request Handler Data": handler_context},
                tags,
            ),
        ]

        for handler_context_arg, scope_arg, expected_scope_contexts, expected_scope_tags in cases:
            print_and_capture_handler_exception(self.handler_error, handler_context_arg, scope_arg)

            capture_exception_scope_kwarg = mock_capture_exception.call_args.kwargs.get("scope")

            assert isinstance(capture_exception_scope_kwarg, Scope)
            assert capture_exception_scope_kwarg._contexts == expected_scope_contexts
            assert capture_exception_scope_kwarg._tags == expected_scope_tags


class FooBarError(Exception):
    pass


class HandleQueryErrorsTest(APITestCase):
    @patch("sentry.api.utils.ParseError")
    def test_handle_query_errors(self, mock_parse_error: MagicMock) -> None:
        exceptions = [
            DatasetSelectionError,
            IncompatibleMetricsQuery,
            InvalidSearchQuery,
            QueryConnectionFailed,
            QueryExecutionError,
            QueryExecutionTimeMaximum,
            QueryIllegalTypeOfArgument,
            QueryMemoryLimitExceeded,
            QueryMissingColumn,
            QueryOutsideRetentionError,
            QuerySizeExceeded,
            QueryTooManySimultaneous,
            SchemaValidationError,
            SnubaError,
            UnqualifiedQueryError,
        ]
        mock_parse_error.return_value = FooBarError()
        for ex in exceptions:
            try:
                with handle_query_errors():
                    raise ex
            except Exception as e:
                assert isinstance(e, (FooBarError, APIException))

    def test_handle_postgres_timeout(self) -> None:
        class TimeoutError(OperationalError):
            def __str__(self) -> str:
                return "canceling statement due to statement timeout"

        try:
            with handle_query_errors():
                raise TimeoutError()
        except Exception as e:
            assert isinstance(e, Throttled)
            assert (
                str(e) == "Query timeout. Please try with a smaller date range or fewer conditions."
            )

    def test_handle_postgres_user_cancel(self) -> None:
        class UserCancelError(OperationalError):
            def __str__(self) -> str:
                return "canceling statement due to user request"

        try:
            with handle_query_errors():
                raise UserCancelError()
        except Exception as e:
            assert isinstance(e, UserCancelError)  # Should propagate original error

    @patch("sentry.api.utils.ParseError")
    def test_handle_other_operational_error(self, mock_parse_error: MagicMock) -> None:
        class OtherError(OperationalError):
            pass

        try:
            with handle_query_errors():
                raise OtherError()
        except Exception as e:
            assert isinstance(e, OtherError)  # Should propagate original error
            mock_parse_error.assert_not_called()

    def test_handle_snuba_rpc_too_many_simultaneous(self) -> None:
        """ClickHouse 'Too many simultaneous queries' via RPC should return 429, not 500."""
        from sentry_protos.snuba.v1.error_pb2 import Error as ErrorProto

        error_proto = ErrorProto(
            code=500,
            message="Code: 202. DB::Exception: Too many simultaneous queries. Maximum: 100.",
        )
        try:
            with handle_query_errors():
                raise SnubaRPCTooManySimultaneous(error_proto)
        except Exception as e:
            assert isinstance(e, Throttled)


class ClampDateRangeTest(unittest.TestCase):
    def test_no_clamp_if_range_under_max(self) -> None:
        start = datetime.datetime(2024, 1, 1)
        end = datetime.datetime(2024, 1, 2)
        max_timedelta = datetime.timedelta(days=7)

        assert clamp_date_range((start, end), max_timedelta) == (start, end)

    def test_no_clamp_for_negative_range(self) -> None:
        start = datetime.datetime(2024, 1, 1)
        end = datetime.datetime(2023, 1, 2)
        max_timedelta = datetime.timedelta(hours=1)

        assert clamp_date_range((start, end), max_timedelta) == (start, end)

    def test_clamps_even_to_zero(self) -> None:
        start = datetime.datetime(2024, 1, 1)
        end = datetime.datetime(2024, 1, 2)
        max_timedelta = datetime.timedelta(0)

        assert clamp_date_range((start, end), max_timedelta) == (end, end)

    def test_clamps_to_end(self) -> None:
        start = datetime.datetime(2024, 1, 1)
        end = datetime.datetime(2024, 1, 14)
        max_timedelta = datetime.timedelta(days=1)

        assert clamp_date_range((start, end), max_timedelta) == (
            datetime.datetime(2024, 1, 13),
            end,
        )


class TestToValidIntId:
    def test_valid_integer_input(self) -> None:
        assert to_valid_int_id("test_id", 123) == 123

    def test_valid_string_input(self) -> None:
        assert to_valid_int_id("test_id", "456") == 456

    def test_zero_is_valid(self) -> None:
        assert to_valid_int_id("test_id", 0) == 0
        assert to_valid_int_id("test_id", "0") == 0

    def test_negative_numbers_are_invalid(self) -> None:
        with pytest.raises(ValidationError) as exc_info:
            to_valid_int_id("test_id", -1)
        assert isinstance(exc_info.value.detail, dict)
        assert "test_id" in exc_info.value.detail
        assert "not a valid integer id" in exc_info.value.detail["test_id"]

        with pytest.raises(ValidationError) as exc_info:
            to_valid_int_id("test_id", "-1")
        assert isinstance(exc_info.value.detail, dict)
        assert "test_id" in exc_info.value.detail
        assert "not a valid integer id" in exc_info.value.detail["test_id"]

    def test_max_value_boundary(self) -> None:
        max_val = BoundedBigAutoField.MAX_VALUE
        assert to_valid_int_id("test_id", max_val) == max_val
        assert to_valid_int_id("test_id", str(max_val)) == max_val

    def test_exceeds_max_value(self) -> None:
        too_large = BoundedBigAutoField.MAX_VALUE + 1
        with pytest.raises(ValidationError) as exc_info:
            to_valid_int_id("test_id", too_large)
        assert isinstance(exc_info.value.detail, dict)
        assert "test_id" in exc_info.value.detail
        assert "not a valid integer id" in exc_info.value.detail["test_id"]

        with pytest.raises(ValidationError) as exc_info:
            to_valid_int_id("test_id", str(too_large))
        assert isinstance(exc_info.value.detail, dict)
        assert "test_id" in exc_info.value.detail
        assert "not a valid integer id" in exc_info.value.detail["test_id"]

    def test_non_numeric_string(self) -> None:
        with pytest.raises(ValidationError) as exc_info:
            to_valid_int_id("test_id", "not_a_number")
        assert isinstance(exc_info.value.detail, dict)
        assert "test_id" in exc_info.value.detail
        assert "not a valid integer id" in exc_info.value.detail["test_id"]

    def test_empty_string(self) -> None:
        with pytest.raises(ValidationError) as exc_info:
            to_valid_int_id("test_id", "")
        assert "test_id" in exc_info.value.detail

    def test_float_string(self) -> None:
        with pytest.raises(ValidationError) as exc_info:
            to_valid_int_id("test_id", "123.45")
        assert "test_id" in exc_info.value.detail

    def test_field_name_in_error(self) -> None:
        with pytest.raises(ValidationError) as exc_info:
            to_valid_int_id("projectId", "invalid")
        assert "projectId" in exc_info.value.detail

        with pytest.raises(ValidationError) as exc_info:
            to_valid_int_id("detectorId", -1)
        assert "detectorId" in exc_info.value.detail

    def test_raise_404_on_non_numeric_string(self) -> None:
        with pytest.raises(ResourceDoesNotExist):
            to_valid_int_id("test_id", "not_a_number", raise_404=True)

    def test_raise_404_on_negative_number(self) -> None:
        with pytest.raises(ResourceDoesNotExist):
            to_valid_int_id("test_id", -1, raise_404=True)

        with pytest.raises(ResourceDoesNotExist):
            to_valid_int_id("test_id", "-1", raise_404=True)

    def test_raise_404_on_exceeds_max_value(self) -> None:
        too_large = BoundedBigAutoField.MAX_VALUE + 1
        with pytest.raises(ResourceDoesNotExist):
            to_valid_int_id("test_id", too_large, raise_404=True)

        with pytest.raises(ResourceDoesNotExist):
            to_valid_int_id("test_id", str(too_large), raise_404=True)

    def test_raise_404_on_empty_string(self) -> None:
        with pytest.raises(ResourceDoesNotExist):
            to_valid_int_id("test_id", "", raise_404=True)

    def test_raise_404_valid_input_still_works(self) -> None:
        assert to_valid_int_id("test_id", 123, raise_404=True) == 123
        assert to_valid_int_id("test_id", "456", raise_404=True) == 456
        assert to_valid_int_id("test_id", 0, raise_404=True) == 0


class TestToValidIntIdList:
    def test_empty_list(self) -> None:
        assert to_valid_int_id_list("test_ids", []) == []

    def test_valid_integer_list(self) -> None:
        assert to_valid_int_id_list("test_ids", [1, 2, 3]) == [1, 2, 3]

    def test_valid_string_list(self) -> None:
        assert to_valid_int_id_list("test_ids", ["1", "2", "3"]) == [1, 2, 3]

    def test_mixed_string_and_int_list(self) -> None:
        assert to_valid_int_id_list("test_ids", [1, "2", 3, "4"]) == [1, 2, 3, 4]

    def test_list_with_zero(self) -> None:
        assert to_valid_int_id_list("test_ids", [0, 1, 2]) == [0, 1, 2]
        assert to_valid_int_id_list("test_ids", ["0", "1", "2"]) == [0, 1, 2]

    def test_list_with_invalid_value(self) -> None:
        with pytest.raises(ValidationError) as exc_info:
            to_valid_int_id_list("test_ids", [1, "invalid", 3])
        assert "test_ids" in exc_info.value.detail

    def test_list_with_negative_value(self) -> None:
        with pytest.raises(ValidationError) as exc_info:
            to_valid_int_id_list("test_ids", [1, -2, 3])
        assert "test_ids" in exc_info.value.detail

    def test_list_with_value_exceeding_max(self) -> None:
        too_large = BoundedBigAutoField.MAX_VALUE + 1
        with pytest.raises(ValidationError) as exc_info:
            to_valid_int_id_list("test_ids", [1, too_large, 3])
        assert "test_ids" in exc_info.value.detail

    def test_list_fails_on_first_invalid(self) -> None:
        with pytest.raises(ValidationError):
            to_valid_int_id_list("test_ids", ["invalid", "also_invalid"])

    def test_list_with_max_boundary_value(self) -> None:
        max_val = BoundedBigAutoField.MAX_VALUE
        result = to_valid_int_id_list("test_ids", [1, max_val, 100])
        assert result == [1, max_val, 100]

import datetime
import unittest
from unittest.mock import MagicMock, patch

import pytest
from django.utils import timezone
from rest_framework.exceptions import APIException
from sentry_sdk import Scope

from sentry.api.utils import (
    MAX_STATS_PERIOD,
    clamp_date_range,
    get_date_range_from_params,
    handle_query_errors,
    print_and_capture_handler_exception,
)
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
    RateLimitExceeded,
    SchemaValidationError,
    SnubaError,
    UnqualifiedQueryError,
)


class GetDateRangeFromParamsTest(unittest.TestCase):
    def test_timeframe(self):
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

    def test_date_range(self):
        start, end = get_date_range_from_params({"start": "2018-11-01", "end": "2018-11-07"})

        assert start == datetime.datetime(2018, 11, 1, tzinfo=datetime.UTC)
        assert end == datetime.datetime(2018, 11, 7, tzinfo=datetime.UTC)

        with pytest.raises(InvalidParams):
            get_date_range_from_params(
                {"start": "2018-11-01T00:00:00", "end": "2018-11-01T00:00:00"}
            )

    @freeze_time("2018-12-11 03:21:34")
    def test_no_params(self):
        start, end = get_date_range_from_params({})
        assert start == timezone.now() - MAX_STATS_PERIOD
        assert end == timezone.now()

    @freeze_time("2018-12-11 03:21:34")
    def test_no_params_optional(self):
        start, end = get_date_range_from_params({}, optional=True)
        assert start is None
        assert end is None

    @freeze_time("2018-12-11 03:21:34")
    def test_relative_date_range(self):
        start, end = get_date_range_from_params({"timeframeStart": "14d", "timeframeEnd": "7d"})

        assert start == datetime.datetime(2018, 11, 27, 3, 21, 34, tzinfo=datetime.UTC)
        assert end == datetime.datetime(2018, 12, 4, 3, 21, 34, tzinfo=datetime.UTC)

        start, end = get_date_range_from_params({"statsPeriodStart": "14d", "statsPeriodEnd": "7d"})

        assert start == datetime.datetime(2018, 11, 27, 3, 21, 34, tzinfo=datetime.UTC)
        assert end == datetime.datetime(2018, 12, 4, 3, 21, 34, tzinfo=datetime.UTC)

    @freeze_time("2018-12-11 03:21:34")
    def test_relative_date_range_incomplete(self):
        with pytest.raises(InvalidParams):
            start, end = get_date_range_from_params({"timeframeStart": "14d"})


class PrintAndCaptureHandlerExceptionTest(APITestCase):
    def setUp(self):
        self.handler_error = Exception("nope")

    @patch("sys.stderr.write")
    def test_logs_error_locally(self, mock_stderr_write: MagicMock):
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
    ):
        print_and_capture_handler_exception(self.handler_error)

        assert mock_capture_exception.call_args.args[0] == self.handler_error

    @patch("sentry.api.utils.capture_exception")
    def test_merges_handler_context_with_scope(
        self,
        mock_capture_exception: MagicMock,
    ):
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


class HandleQueryErrorsTest:
    @patch("sentry.api.utils.ParseError")
    def test_handle_query_errors(self, mock_parse_error):
        exceptions = [
            DatasetSelectionError,
            IncompatibleMetricsQuery,
            InvalidParams,
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
            RateLimitExceeded,
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


class ClampDateRangeTest(unittest.TestCase):
    def test_no_clamp_if_range_under_max(self):
        start = datetime.datetime(2024, 1, 1)
        end = datetime.datetime(2024, 1, 2)
        max_timedelta = datetime.timedelta(days=7)

        assert clamp_date_range((start, end), max_timedelta) == (start, end)

    def test_no_clamp_for_negative_range(self):
        start = datetime.datetime(2024, 1, 1)
        end = datetime.datetime(2023, 1, 2)
        max_timedelta = datetime.timedelta(hours=1)

        assert clamp_date_range((start, end), max_timedelta) == (start, end)

    def test_clamps_even_to_zero(self):
        start = datetime.datetime(2024, 1, 1)
        end = datetime.datetime(2024, 1, 2)
        max_timedelta = datetime.timedelta(0)

        assert clamp_date_range((start, end), max_timedelta) == (end, end)

    def test_clamps_to_end(self):
        start = datetime.datetime(2024, 1, 1)
        end = datetime.datetime(2024, 1, 14)
        max_timedelta = datetime.timedelta(days=1)

        assert clamp_date_range((start, end), max_timedelta) == (
            datetime.datetime(2024, 1, 13),
            end,
        )

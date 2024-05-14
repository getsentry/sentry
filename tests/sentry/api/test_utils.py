import datetime
import unittest
from unittest.mock import MagicMock, patch

import pytest
from django.utils import timezone
from rest_framework.exceptions import APIException
from sentry_sdk import Scope

from sentry.api.utils import (
    MAX_STATS_PERIOD,
    customer_domain_path,
    get_date_range_from_params,
    handle_query_errors,
    id_or_slug_path_params_enabled,
    print_and_capture_handler_exception,
)
from sentry.exceptions import IncompatibleMetricsQuery, InvalidParams, InvalidSearchQuery
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.options import override_options
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


def test_customer_domain_path():
    scenarios = [
        # Input, expected
        ["/settings/", "/settings/"],
        # Organization settings views.
        ["/settings/acme/", "/settings/organization/"],
        ["/settings/organization", "/settings/organization/"],
        ["/settings/sentry/members/", "/settings/members/"],
        ["/settings/sentry/members/3/", "/settings/members/3/"],
        ["/settings/sentry/teams/peeps/", "/settings/teams/peeps/"],
        ["/settings/sentry/billing/receipts/", "/settings/billing/receipts/"],
        [
            "/settings/acme/developer-settings/release-bot/",
            "/settings/developer-settings/release-bot/",
        ],
        # Account settings should stay the same
        ["/settings/account/", "/settings/account/"],
        ["/settings/account/security/", "/settings/account/security/"],
        ["/settings/account/details/", "/settings/account/details/"],
        ["/join-request/acme", "/join-request/"],
        ["/join-request/acme/", "/join-request/"],
        ["/onboarding/acme/", "/onboarding/"],
        ["/onboarding/acme/project/", "/onboarding/project/"],
        ["/organizations/new/", "/organizations/new/"],
        ["/organizations/albertos-apples/issues/", "/issues/"],
        ["/organizations/albertos-apples/issues/?_q=all#hash", "/issues/?_q=all#hash"],
        ["/acme/project-slug/getting-started/", "/getting-started/project-slug/"],
        [
            "/acme/project-slug/getting-started/python",
            "/getting-started/project-slug/python",
        ],
        ["/settings/projects/python/filters/", "/settings/projects/python/filters/"],
        ["/settings/projects/onboarding/abc123/", "/settings/projects/onboarding/abc123/"],
        [
            "/settings/projects/join-request/abc123/",
            "/settings/projects/join-request/abc123/",
        ],
        [
            "/settings/projects/python/filters/discarded/",
            "/settings/projects/python/filters/discarded/",
        ],
        [
            "/settings/projects/getting-started/abc123/",
            "/settings/projects/getting-started/abc123/",
        ],
        ["/settings/teams/peeps/", "/settings/teams/peeps/"],
        ["/settings/billing/checkout/?_q=all#hash", "/settings/billing/checkout/?_q=all#hash"],
        [
            "/settings/billing/bundle-checkout/?_q=all#hash",
            "/settings/billing/bundle-checkout/?_q=all#hash",
        ],
    ]
    for input_path, expected in scenarios:
        assert expected == customer_domain_path(input_path)


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


class IdOrSlugPathParamsEnabledTest(TestCase):
    def test_no_options_enabled(self):
        assert not id_or_slug_path_params_enabled("TestEndpoint.convert_args")

    @override_options({"api.id-or-slug-enabled": True})
    def test_ga_option_enabled(self):
        assert id_or_slug_path_params_enabled(convert_args_class="TestEndpoint.convert_args")

    @override_options({"api.id-or-slug-enabled-ea-endpoints": ["TestEndpoint.convert_args"]})
    def test_ea_endpoint_option_enabled(self):
        assert not id_or_slug_path_params_enabled(convert_args_class="NotTestEndpoint.convert_args")
        assert id_or_slug_path_params_enabled(convert_args_class="TestEndpoint.convert_args")

    @override_options({"api.id-or-slug-enabled-ea-org": ["sentry"]})
    def test_ea_org_option_enabled(self):
        assert not id_or_slug_path_params_enabled("NotTestEndpoint.convert_args", "not-sentry")
        assert not id_or_slug_path_params_enabled("NotTestEndpoint.convert_args", "sentry")

    @override_options({"api.id-or-slug-enabled-ea-org": ["sentry"]})
    @override_options({"api.id-or-slug-enabled-ea-endpoints": ["TestEndpoint.convert_args"]})
    def test_ea_org_and_endpoint_option_enabled(self):
        assert not id_or_slug_path_params_enabled("NotTestEndpoint.convert_args", "not-sentry")
        assert not id_or_slug_path_params_enabled("NotTestEndpoint.convert_args", "sentry")
        assert not id_or_slug_path_params_enabled("TestEndpoint.convert_args", "not-sentry")
        assert id_or_slug_path_params_enabled("TestEndpoint.convert_args", "sentry")

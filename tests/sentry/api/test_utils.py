import datetime
import unittest
from unittest.mock import MagicMock, patch

import pytest
from django.utils import timezone
from sentry_sdk import Scope
from sentry_sdk.utils import exc_info_from_error

from sentry.api.utils import (
    MAX_STATS_PERIOD,
    customer_domain_path,
    get_date_range_from_params,
    print_and_capture_handler_exception,
)
from sentry.exceptions import InvalidParams
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time


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

        assert start == datetime.datetime(2018, 11, 1, tzinfo=timezone.utc)
        assert end == datetime.datetime(2018, 11, 7, tzinfo=timezone.utc)

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

        assert start == datetime.datetime(2018, 11, 27, 3, 21, 34, tzinfo=timezone.utc)
        assert end == datetime.datetime(2018, 12, 4, 3, 21, 34, tzinfo=timezone.utc)

        start, end = get_date_range_from_params({"statsPeriodStart": "14d", "statsPeriodEnd": "7d"})

        assert start == datetime.datetime(2018, 11, 27, 3, 21, 34, tzinfo=timezone.utc)
        assert end == datetime.datetime(2018, 12, 4, 3, 21, 34, tzinfo=timezone.utc)

    @freeze_time("2018-12-11 03:21:34")
    def test_relative_date_range_incomplete(self):
        with pytest.raises(InvalidParams):
            start, end = get_date_range_from_params({"timeframeStart": "14d"})


class PrintAndCaptureHandlerExceptionTest(APITestCase):
    def setUp(self):
        self.handler_error = Exception("nope")

    @patch("sys.stderr.write")
    def test_logs_error_locally(self, mock_stderr_write: MagicMock):
        exc_info = exc_info_from_error(self.handler_error)

        with patch("sys.exc_info", return_value=exc_info):
            print_and_capture_handler_exception(self.handler_error)

            mock_stderr_write.assert_called_with("Exception: nope\n")

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

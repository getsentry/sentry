import datetime
import unittest

import pytest
from django.utils import timezone
from freezegun import freeze_time

from sentry.api.utils import (
    MAX_STATS_PERIOD,
    InvalidParams,
    customer_domain_path,
    get_date_range_from_params,
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
    ]
    for input_path, expected in scenarios:
        assert expected == customer_domain_path(input_path)

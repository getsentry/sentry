from __future__ import absolute_import

import datetime

from django.utils import timezone

from sentry.api.utils import get_date_range_from_params, InvalidParams
from sentry.testutils import TestCase


class GetDateRangeFromParamsTest(TestCase):
    def test_stats_period(self):
        start, end = get_date_range_from_params({'statsPeriod': '14h'})
        assert end - datetime.timedelta(hours=14) == start

        start, end = get_date_range_from_params({'statsPeriod': '14d'})
        assert end - datetime.timedelta(days=14) == start

        start, end = get_date_range_from_params({'statsPeriod': '60m'})
        assert end - datetime.timedelta(minutes=60) == start

        start, end = get_date_range_from_params({'statsPeriod': '3600s'})
        assert end - datetime.timedelta(seconds=3600) == start

        with self.assertRaises(InvalidParams):
            get_date_range_from_params({'statsPeriod': '1s'})

    def test_date_range(self):
        start, end = get_date_range_from_params({
            'start': '2018-11-01',
            'end': '2018-11-07',
        })

        assert start == datetime.datetime(2018, 11, 1, tzinfo=timezone.utc)
        assert end == datetime.datetime(2018, 11, 7, tzinfo=timezone.utc)

        with self.assertRaises(InvalidParams):
            get_date_range_from_params({'start': '2018-11-01'})

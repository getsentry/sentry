from __future__ import absolute_import

import datetime
import pytz

from sentry.utils.dates import (
    to_datetime,
    to_timestamp,
)


def test_timestamp_conversions():
    value = datetime.datetime(2015, 10, 1, 21, 19, 5, 648517, tzinfo=pytz.utc)
    assert int(to_timestamp(value)) == int(value.strftime('%s'))
    assert to_datetime(to_timestamp(value)) == value

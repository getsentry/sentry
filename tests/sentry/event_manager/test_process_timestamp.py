from __future__ import absolute_import

from datetime import datetime

from sentry.event_manager import process_timestamp
from sentry.utils.meta import Meta
from sentry.testutils import TestCase


class ProcessTimestampTest(TestCase):
    def setUp(self):
        self.meta = Meta()

    def test_iso_timestamp(self):
        assert process_timestamp(
            '2012-01-01T10:30:45',
            self.meta,
            current_datetime=datetime(2012, 1, 1, 10, 30, 45),
        ) == 1325413845.0

    def test_iso_timestamp_with_ms(self):
        assert process_timestamp(
            '2012-01-01T10:30:45.434',
            self.meta,
            current_datetime=datetime(2012, 1, 1, 10, 30, 45, 434000),
        ) == 1325413845.0

    def test_timestamp_iso_timestamp_with_Z(self):
        assert process_timestamp(
            '2012-01-01T10:30:45Z',
            self.meta,
            current_datetime=datetime(2012, 1, 1, 10, 30, 45),
        ) == 1325413845.0

    def test_invalid_timestamp(self):
        assert process_timestamp('foo', self.meta) is None
        assert len(list(self.meta.iter_errors())) == 1

    def test_invalid_numeric_timestamp(self):
        assert process_timestamp('100000000000000000000.0', self.meta) is None
        assert len(list(self.meta.iter_errors())) == 1

    def test_future_timestamp(self):
        assert process_timestamp('2052-01-01T10:30:45Z', self.meta) is None
        assert len(list(self.meta.iter_errors())) == 1

    def test_long_microseconds_value(self):
        assert process_timestamp(
            '2012-01-01T10:30:45.341324Z',
            self.meta,
            current_datetime=datetime(2012, 1, 1, 10, 30, 45),
        ) == 1325413845.0

    def test_invalid_type(self):
        assert process_timestamp({}, self.meta) is None

from __future__ import absolute_import

import pytest

from datetime import datetime

from sentry.event_manager import InvalidTimestamp, process_timestamp


def test_iso_timestamp():
    assert process_timestamp(
        '2012-01-01T10:30:45',
        current_datetime=datetime(2012, 1, 1, 10, 30, 45),
    ) == 1325413845.0


def test_iso_timestamp_with_ms():
    assert process_timestamp(
        '2012-01-01T10:30:45.434',
        current_datetime=datetime(2012, 1, 1, 10, 30, 45, 434000),
    ) == 1325413845.0


def test_timestamp_iso_timestamp_with_Z():
    assert process_timestamp(
        '2012-01-01T10:30:45Z',
        current_datetime=datetime(2012, 1, 1, 10, 30, 45),
    ) == 1325413845.0


def test_invalid_timestamp():
    with pytest.raises(InvalidTimestamp):
        process_timestamp('foo')


def test_invalid_numeric_timestamp():
    with pytest.raises(InvalidTimestamp):
        process_timestamp('100000000000000000000.0')


def test_future_timestamp():
    with pytest.raises(InvalidTimestamp):
        process_timestamp('2052-01-01T10:30:45Z')


def test_long_microseconds_value():
    assert process_timestamp(
        '2012-01-01T10:30:45.341324Z',
        current_datetime=datetime(2012, 1, 1, 10, 30, 45),
    ) == 1325413845.0

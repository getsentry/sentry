from datetime import datetime, timedelta

from sentry.profiles.flamegraph import split_datetime_range_exponential


def test_split_datetime_range_exponential_with_days():
    start = datetime(2023, 1, 1)
    end = datetime(2023, 1, 31)
    initial_delta = timedelta(days=1)
    max_chunk_delta = timedelta(days=8)

    result = list(split_datetime_range_exponential(start, end, initial_delta, max_chunk_delta))

    expected_chunks = [
        (datetime(2023, 1, 1), datetime(2023, 1, 2)),  # Delta: 1 day
        (datetime(2023, 1, 2), datetime(2023, 1, 4)),  # Delta: 2 days
        (datetime(2023, 1, 4), datetime(2023, 1, 8)),  # Delta: 4 days
        (datetime(2023, 1, 8), datetime(2023, 1, 16)),  # Delta: 8 days (max reached)
        (datetime(2023, 1, 16), datetime(2023, 1, 24)),  # Delta: 8 days
        (datetime(2023, 1, 24), datetime(2023, 1, 31)),  # Final chunk trimmed to end
    ]

    assert result == expected_chunks


def test_split_datetime_range_exponential_with_hours():
    start_time = datetime(2024, 5, 1, 6, 0, 0)
    end_time = datetime(2024, 5, 2, 12, 0, 0)
    initial_h_delta = timedelta(hours=2)
    max_h_delta = timedelta(hours=8)

    result = list(
        split_datetime_range_exponential(start_time, end_time, initial_h_delta, max_h_delta)
    )

    expected_chunks = [
        (datetime(2024, 5, 1, 6, 0), datetime(2024, 5, 1, 8, 0)),  # Delta: 2 hours
        (datetime(2024, 5, 1, 8, 0), datetime(2024, 5, 1, 12, 0)),  # Delta: 4 hours
        (datetime(2024, 5, 1, 12, 0), datetime(2024, 5, 1, 20, 0)),  # Delta: 8 hours (max reached)
        (datetime(2024, 5, 1, 20, 0), datetime(2024, 5, 2, 4, 0)),  # Delta: 8 hours
        (datetime(2024, 5, 2, 4, 0), datetime(2024, 5, 2, 12, 0)),  # Final chunk fits perfectly
    ]

    assert result == expected_chunks

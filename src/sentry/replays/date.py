from datetime import datetime


def round_date_to_minute_interval(date: datetime, interval: int) -> datetime:
    """
    Round date to the nearest minute interval.

    This function always rounds dates down. It never queries for dates in the future.
    """
    assert interval > 0, interval
    assert interval < 60, interval

    # Bucket the minute by dividing and rounding down. If given "15" as the interval four possible
    # buckets will be produced: 0, 1, 2, and 3.
    minute_bucket = date.minute // interval

    # After finding the bucket we multiply by the interval to get a minute value. If the interval
    # was 15 0 becomes 0, 1 becomes 15, and so on. Crucially because we're rounding down we will
    # never exceed minute 45. Producing a minute value of 60 or over would raise an exception. If
    # we had rounded up then we would need to incremen the hour, day, month, year, etc. which
    # becomes a significantly more complex (but doable) operation.
    minute = minute_bucket * interval

    return date.replace(minute=minute, second=0, microsecond=0)

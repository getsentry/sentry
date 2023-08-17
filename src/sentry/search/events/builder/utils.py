from datetime import datetime, timedelta


def remove_minutes(timestamp, floor=True):
    if floor:
        return datetime(timestamp.year, timestamp.month, timestamp.day, timestamp.hour)
    else:
        return datetime(timestamp.year, timestamp.month, timestamp.day, timestamp.hour) + timedelta(
            hours=1
        )


def remove_hours(timestamp, floor=True):
    if floor:
        return datetime(timestamp.year, timestamp.month, timestamp.day)
    else:
        return datetime(timestamp.year, timestamp.month, timestamp.day) + timedelta(days=1)

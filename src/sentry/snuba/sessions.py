from datetime import datetime, timedelta, timezone


def _make_stats(start: datetime, rollup: int, buckets: int, default: int = 0) -> list[list[int]]:
    rv = []
    start_ts = int(start.timestamp() // rollup + 1) * rollup
    for x in range(buckets):
        rv.append([start_ts, default])
        start_ts += rollup
    return rv


STATS_PERIODS = {
    "1h": (3600, 1),
    "24h": (3600, 24),
    "1d": (3600, 24),
    "48h": (3600, 48),
    "2d": (3600, 48),
    "7d": (86400, 7),
    "14d": (86400, 14),
    "30d": (86400, 30),
    "90d": (259200, 30),
}


def get_rollup_starts_and_buckets(
    period: str, now: datetime | None = None
) -> tuple[int, datetime, int]:
    if period not in STATS_PERIODS:
        raise TypeError("Invalid stats period")
    seconds, buckets = STATS_PERIODS[period]
    if now is None:
        now = datetime.now(timezone.utc)
    start = now - timedelta(seconds=seconds * buckets)
    return seconds, start, buckets

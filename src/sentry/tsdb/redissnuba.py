from sentry.tsdb.snuba import SnubaTSDB


class RedisSnubaTSDB(SnubaTSDB):
    """Alias of SnubaTSDB for configs that still name it; redis and switchover_timestamp are ignored."""

    def __init__(self, switchover_timestamp=None, redis=None, snuba=None, **options):
        super().__init__(**(snuba or {}), **options)

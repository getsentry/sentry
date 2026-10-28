from sentry.tsdb.base import TSDBModel
from sentry.tsdb.redissnuba import RedisSnubaTSDB


def test_accepts_legacy_redis_options() -> None:
    tsdb = RedisSnubaTSDB(redis={"cluster": "tsdb", "vnodes": 32}, switchover_timestamp=0)
    tsdb.incr(TSDBModel.project, 1)

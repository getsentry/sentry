from __future__ import absolute_import

import time
import inspect
import six

from sentry.tsdb.base import BaseTSDB
from sentry.tsdb.dummy import DummyTSDB
from sentry.tsdb.redis import RedisTSDB
from sentry.tsdb.snuba import SnubaTSDB


READ = 0
WRITE = 1


def single_model_argument(callargs):
    return set([callargs["model"]])


def multiple_model_argument(callargs):
    return set(callargs["models"])


def dont_do_this(callargs):
    raise NotImplementedError("do not run this please")


method_specifications = {
    # method: (type, function(callargs) -> set[model])
    "get_range": (READ, single_model_argument),
    "get_sums": (READ, single_model_argument),
    "get_distinct_counts_series": (READ, single_model_argument),
    "get_distinct_counts_totals": (READ, single_model_argument),
    "get_distinct_counts_union": (READ, single_model_argument),
    "get_most_frequent": (READ, single_model_argument),
    "get_most_frequent_series": (READ, single_model_argument),
    "get_frequency_series": (READ, single_model_argument),
    "get_frequency_totals": (READ, single_model_argument),
    "incr": (WRITE, single_model_argument),
    "incr_multi": (WRITE, lambda callargs: {item[0] for item in callargs["items"]}),
    "merge": (WRITE, single_model_argument),
    "delete": (WRITE, multiple_model_argument),
    "record": (WRITE, single_model_argument),
    "record_multi": (WRITE, lambda callargs: {model for model, key, values in callargs["items"]}),
    "merge_distinct_counts": (WRITE, single_model_argument),
    "delete_distinct_counts": (WRITE, multiple_model_argument),
    "record_frequency_multi": (
        WRITE,
        lambda callargs: {model for model, data in callargs["requests"]},
    ),
    "merge_frequencies": (WRITE, single_model_argument),
    "delete_frequencies": (WRITE, multiple_model_argument),
    "flush": (WRITE, dont_do_this),
}

assert (
    set(method_specifications) == BaseTSDB.__read_methods__ | BaseTSDB.__write_methods__
), "all read and write methods must have a specification defined"

model_backends = {
    # model: (read, write)
    model: ("redis", "redis") if model not in SnubaTSDB.model_query_settings else ("snuba", "dummy")
    for model in BaseTSDB.models
}


def selector_func(method, callargs, switchover_timestamp=None):
    spec = method_specifications.get(method)
    if spec is None:
        return "redis"  # default backend (possibly invoke base directly instead?)

    if switchover_timestamp is not None and time.time() < switchover_timestamp:
        return "redis"  # snuba does not yet have all data

    operation_type, model_extractor = spec
    backends = {model_backends[model][operation_type] for model in model_extractor(callargs)}

    assert len(backends) == 1, "request was not directed to a single backend"
    return backends.pop()


def make_method(key):
    def method(self, *a, **kw):
        callargs = inspect.getcallargs(getattr(BaseTSDB, key), self, *a, **kw)
        backend = selector_func(key, callargs, self.switchover_timestamp)
        return getattr(self.backends[backend], key)(*a, **kw)

    return method


# We have to apply these methods into RedisSnubaTSDB through
# a metaclass since we can't simply overload `__getattr__` due to
# the fact that the subclass BaseTSDB already defines all the methods.
# So we need to actually apply methods on top to override them.
class RedisSnubaTSDBMeta(type):
    def __new__(cls, name, bases, attrs):
        for key in method_specifications.keys():
            attrs[key] = make_method(key)
        return type.__new__(cls, name, bases, attrs)


@six.add_metaclass(RedisSnubaTSDBMeta)
class RedisSnubaTSDB(BaseTSDB):
    def __init__(self, switchover_timestamp=None, **options):
        """
        A TSDB backend that uses the Snuba outcomes and events datasets as far
        as possible instead of reading/writing to redis. Reading will trigger a
        Snuba query, while writing is a noop as Snuba reads from outcomes.

        Note: Using this backend requires you to start Snuba outcomes consumers
        (not to be confused with the outcomes consumers in Sentry itself).

        :param switchover_timestamp: When set, only start reading from snuba
            after this timestamp (as returned by `time.time()`). When this
            timestamp has not been reached yet, this backend just degrades to
            Redis for *all* keys.

            The default `None` will start reading from Snuba immediately and is
            equivalent to setting a past timestamp.
        """
        self.switchover_timestamp = switchover_timestamp
        self.backends = {
            "dummy": DummyTSDB(),
            "redis": RedisTSDB(**options.pop("redis", {})),
            "snuba": SnubaTSDB(**options.pop("snuba", {})),
        }
        super(RedisSnubaTSDB, self).__init__(**options)

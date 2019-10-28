from __future__ import absolute_import

import functools
import six

from time import time

from sentry import options
from sentry.exceptions import InvalidConfiguration
from sentry.quotas.base import NotRateLimited, Quota, RateLimited
from sentry.utils.redis import get_cluster_from_options, load_script, redis_clusters
from sentry.utils.json import prune_empty_keys

is_rate_limited = load_script("quotas/is_rate_limited.lua")


def get_dynamic_cluster_from_options(setting, config):
    cluster_name = config.get("cluster", "default")
    cluster_opts = options.default_manager.get("redis.clusters").get(cluster_name)
    if cluster_opts is not None and cluster_opts.get("is_redis_cluster"):
        return True, redis_clusters.get(cluster_name), config

    return (False,) + get_cluster_from_options(setting, config)


class BasicRedisQuota(object):
    """
    A quota in the most abstract sense consists of an identifier (such as
    `"organization quota"`, `"smart limit"`, etc) and two integers `limit` and
    `window` (we accept "limit" events per "window" seconds).

    Sentry applies multiple quotas to an event before accepting it, some of
    which can be configured by the user depending on plan. An event will be
    counted against all quotas. For example:

    * If Sentry is told to apply two quotas "one event per minute" and "9999999
      events per hour", it will practically accept only one event per minute
    * If Sentry is told to apply "one event per minute" and "30 events per
      hour", we will be able to get one event accepted every minute. However, if
      we do that for 30 minutes (ingesting 30 events), we will not be able to get
      an event through for the rest of the hour. (This example assumes that we
      start sending events exactly at the start of the time window)

    A `BasicRedisQuota` is a specific quota type that also includes some
    attributes necessary for looking up event counters and refunds in Redis.

    The `BasicRedisQuota` object is not persisted in any way. It is just a
    function argument passed around in code. Most importantly, a
    `BasicRedisQuota` instance does not contain information about how many
    events can still be accepted (that stuff is stored in Redis but isn't typed
    out), it only represents settings that should be applied.
    """

    __slots__ = ["prefix", "subscope", "limit", "window", "reason_code"]

    def __init__(self, prefix=None, subscope=None, limit=None, window=None, reason_code=None):
        if limit == 0:
            assert prefix is None and subscope is None, "zero-sized quotas are not tracked in redis"
            assert window is None, "zero-sized quotas cannot have a window"
        else:
            assert prefix, "measured quotas need a prefix to run in redis"
            assert window and window > 0, "window cannot be zero"

        self.prefix = prefix
        self.subscope = subscope
        # maximum number of events in the given window
        #
        # None indicates "unlimited amount"
        # 0 indicates "reject all"
        # NOTE: Use `quotas.base._limit_from_settings` to map from settings
        self.limit = limit
        # time in seconds that this quota reflects
        self.window = window
        # a machine readable string
        self.reason_code = reason_code

    @classmethod
    def reject_all(cls, reason_code):
        """
        A zero-sized quota, which is never counted in Redis. Unconditionally
        reject the event.
        """

        return cls(limit=0, reason_code=reason_code)

    @classmethod
    def limited(cls, prefix, limit, window, reason_code, subscope=None):
        """
        A regular quota with limit.
        """

        assert limit and limit > 0
        return cls(
            prefix=prefix, limit=limit, window=window, reason_code=reason_code, subscope=subscope
        )

    @classmethod
    def unlimited(cls, prefix, window, subscope=None):
        """
        Unlimited quota that is still being counted.
        """

        return cls(prefix=prefix, window=window, subscope=subscope)

    @property
    def should_track(self):
        """
        Whether the quotas service should track this quota at all.
        """

        return self.prefix is not None

    def to_json(self):
        return prune_empty_keys(
            {
                "prefix": six.text_type(self.prefix) if self.prefix is not None else None,
                "subscope": six.text_type(self.subscope) if self.subscope is not None else None,
                "limit": self.limit,
                "window": self.window,
                "reasonCode": self.reason_code,
            }
        )


class RedisQuota(Quota):
    #: The ``grace`` period allows accommodating for clock drift in TTL
    #: calculation since the clock on the Redis instance used to store quota
    #: metrics may not be in sync with the computer running this code.
    grace = 60

    def __init__(self, **options):
        self.is_redis_cluster, self.cluster, options = get_dynamic_cluster_from_options(
            "SENTRY_QUOTA_OPTIONS", options
        )

        # Based on the `is_redis_cluster` flag, self.cluster is set two one of
        # the following two objects:
        #  - false: `cluster` is a `RBCluster`. Call `get_local_client_for_key`
        #    on the cluster to resolve a client to run a script or query a key.
        #  - true: `cluster` is a `RedisCluster`. It automatically dispatches to
        #    the correct node and can be used as a client directly.

        super(RedisQuota, self).__init__(**options)
        self.namespace = "quota"

    def validate(self):
        try:
            if self.is_redis_cluster:
                self.cluster.ping()
            else:
                with self.cluster.all() as client:
                    client.ping()
        except Exception as e:
            raise InvalidConfiguration(six.text_type(e))

    def __get_redis_client(self, routing_key):
        if self.is_redis_cluster:
            return self.cluster
        else:
            return self.cluster.get_local_client_for_key(routing_key)

    def __get_redis_key(self, quota, timestamp, shift, organization_id):
        if self.is_redis_cluster:
            # new style redis cluster format which always has the organization id in
            local_key = "%s{%s}%s" % (quota.prefix, organization_id, quota.subscope or "")
        else:
            # legacy key format
            local_key = "%s:%s" % (quota.prefix, quota.subscope or organization_id)

        interval = quota.window
        return u"{}:{}:{}".format(self.namespace, local_key, int((timestamp - shift) // interval))

    def get_quotas(self, project, key=None):
        if key:
            key.project = project

        results = []

        pquota = self.get_project_quota(project)
        if pquota[0] is not None:
            results.append(
                BasicRedisQuota.limited(
                    prefix="p",
                    subscope=project.id,
                    limit=pquota[0],
                    window=pquota[1],
                    reason_code="project_quota",
                )
            )

        oquota = self.get_organization_quota(project.organization)
        if oquota[0] is not None:
            results.append(
                BasicRedisQuota.limited(
                    prefix="o", limit=oquota[0], window=oquota[1], reason_code="org_quota"
                )
            )

        if key:
            kquota = self.get_key_quota(key)
            if kquota[0] is not None:
                results.append(
                    BasicRedisQuota.limited(
                        prefix="k",
                        subscope=key.id,
                        limit=kquota[0],
                        window=kquota[1],
                        reason_code="key_quota",
                    )
                )

        return results

    def get_usage(self, organization_id, quotas, timestamp=None):
        if timestamp is None:
            timestamp = time()

        def get_usage_for_quota(client, quota):
            if not quota.should_track:
                return (None, None)

            key = self.__get_redis_key(
                quota, timestamp, organization_id % quota.window, organization_id
            )
            refund_key = self.get_refunded_quota_key(key)

            return (client.get(key), client.get(refund_key))

        def get_value_for_result(result, refund_result):
            if result is None:
                return None

            return int(result.value or 0) - int(refund_result.value or 0)

        if self.is_redis_cluster:
            results = map(functools.partial(get_usage_for_quota, self.cluster), quotas)
        else:
            with self.cluster.fanout() as client:
                results = map(
                    functools.partial(
                        get_usage_for_quota, client.target_key(six.text_type(organization_id))
                    ),
                    quotas,
                )

        return [get_value_for_result(*r) for r in results]

    def get_refunded_quota_key(self, key):
        return u"r:{}".format(key)

    def refund(self, project, key=None, timestamp=None):
        if timestamp is None:
            timestamp = time()

        quotas = [quota for quota in self.get_quotas(project, key=key) if quota.should_track]

        if not quotas:
            return

        client = self.__get_redis_client(six.text_type(project.organization_id))
        pipe = client.pipeline()

        for quota in quotas:
            shift = project.organization_id % quota.window
            # kind of arbitrary, but seems like we don't want this to expire til we're
            # sure the window is over?
            expiry = self.get_next_period_start(quota.window, shift, timestamp) + self.grace
            return_key = self.get_refunded_quota_key(
                self.__get_redis_key(quota, timestamp, shift, project.organization_id)
            )
            pipe.incr(return_key, 1)
            pipe.expireat(return_key, int(expiry))

        pipe.execute()

    def get_next_period_start(self, interval, shift, timestamp):
        """Return the timestamp when the next rate limit period begins for an interval."""
        return (((timestamp - shift) // interval) + 1) * interval + shift

    def is_rate_limited(self, project, key=None, timestamp=None):
        if timestamp is None:
            timestamp = time()

        quotas = self.get_quotas(project, key=key)

        # If there are no quotas to actually check, skip the trip to the database.
        if not quotas:
            return NotRateLimited()

        keys = []
        args = []
        for quota in quotas:
            if quota.limit == 0:
                # A zero-sized quota is the absolute worst-case. Do not call
                # into Redis at all, and do not increment any keys, as one
                # quota has reached capacity (this is how regular quotas behave
                # as well).
                assert quota.window is None
                assert not quota.should_track
                return RateLimited(retry_after=None, reason_code=quota.reason_code)

            assert quota.should_track

            shift = project.organization_id % quota.window
            key = self.__get_redis_key(quota, timestamp, shift, project.organization_id)
            return_key = self.get_refunded_quota_key(key)
            keys.extend((key, return_key))
            expiry = self.get_next_period_start(quota.window, shift, timestamp) + self.grace

            # limit=None is represented as limit=-1 in lua
            lua_quota = quota.limit if quota.limit is not None else -1
            args.extend((lua_quota, int(expiry)))

        if not keys or not args:
            return NotRateLimited()

        client = self.__get_redis_client(six.text_type(project.organization_id))
        rejections = is_rate_limited(client, keys, args)

        if not any(rejections):
            return NotRateLimited()

        worst_case = (0, None)
        for quota, rejected in zip(quotas, rejections):
            if not rejected:
                continue

            shift = project.organization_id % quota.window
            delay = self.get_next_period_start(quota.window, shift, timestamp) - timestamp
            if delay > worst_case[0]:
                worst_case = (delay, quota.reason_code)

        return RateLimited(retry_after=worst_case[0], reason_code=worst_case[1])

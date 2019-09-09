from __future__ import absolute_import

import functools
import six

from time import time

from sentry import options
from sentry.exceptions import InvalidConfiguration
from sentry.quotas.base import NotRateLimited, Quota, RateLimited
from sentry.utils.redis import get_cluster_from_options, load_script, redis_clusters

is_rate_limited = load_script("quotas/is_rate_limited.lua")


def get_dynamic_cluster_from_options(setting, config):
    cluster_name = config.get("cluster", "default")
    cluster_opts = options.default_manager.get("redis.clusters").get(cluster_name)
    if cluster_opts is not None and cluster_opts.get("is_redis_cluster"):
        return True, redis_clusters.get(cluster_name), config

    return (False,) + get_cluster_from_options(setting, config)


class BasicRedisQuota(object):
    __slots__ = ["prefix", "subscope", "limit", "window", "reason_code", "enforce"]

    def __init__(self, prefix, subscope=None, limit=0, window=60, reason_code=None, enforce=True):
        self.prefix = prefix
        self.subscope = subscope
        # maximum number of events in the given window, 0 indicates "no limit"
        self.limit = limit
        # time in seconds that this quota reflects
        self.window = window
        # a machine readable string
        self.reason_code = reason_code
        # should this quota be hard-enforced (or just tracked)
        self.enforce = enforce


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

    def get_quotas_with_limits(self, project, key=None):
        return [
            quota
            for quota in self.get_quotas(project, key=key)
            # x = (key, limit, interval)
            if quota.limit > 0  # a zero limit means "no limit", not "reject all"
        ]

    def get_quotas(self, project, key=None):
        if key:
            key.project = project
        pquota = self.get_project_quota(project)
        oquota = self.get_organization_quota(project.organization)
        results = [
            BasicRedisQuota(
                prefix="p",
                subscope=project.id,
                limit=pquota[0],
                window=pquota[1],
                reason_code="project_quota",
            ),
            BasicRedisQuota(prefix="o", limit=oquota[0], window=oquota[1], reason_code="org_quota"),
        ]
        if key:
            kquota = self.get_key_quota(key)
            results.append(
                BasicRedisQuota(
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
            if quota.limit == 0:
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

        quotas = self.get_quotas_with_limits(project, key=key)

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

        quotas = self.get_quotas_with_limits(project, key=key)

        # If there are no quotas to actually check, skip the trip to the database.
        if not quotas:
            return NotRateLimited()

        keys = []
        args = []
        for quota in quotas:
            shift = project.organization_id % quota.window
            key = self.__get_redis_key(quota, timestamp, shift, project.organization_id)
            return_key = self.get_refunded_quota_key(key)
            keys.extend((key, return_key))
            expiry = self.get_next_period_start(quota.window, shift, timestamp) + self.grace
            args.extend((quota.limit, int(expiry)))

        client = self.__get_redis_client(six.text_type(project.organization_id))
        rejections = is_rate_limited(client, keys, args)

        if any(rejections):
            enforce = False
            worst_case = (0, None)
            for quota, rejected in zip(quotas, rejections):
                if not rejected:
                    continue
                if quota.enforce:
                    enforce = True
                    shift = project.organization_id % quota.window
                    delay = self.get_next_period_start(quota.window, shift, timestamp) - timestamp
                    if delay > worst_case[0]:
                        worst_case = (delay, quota.reason_code)
            if enforce:
                return RateLimited(retry_after=worst_case[0], reason_code=worst_case[1])
        return NotRateLimited()

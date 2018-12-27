"""
sentry.quotas.redis
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import functools
import six

from time import time

from sentry.exceptions import InvalidConfiguration
from sentry.quotas.base import NotRateLimited, Quota, RateLimited
from sentry.utils.redis import get_cluster_from_options, load_script

is_rate_limited = load_script('quotas/is_rate_limited.lua')


class BasicRedisQuota(object):
    __slots__ = ['key', 'limit', 'window', 'reason_code', 'enforce']

    def __init__(self, key, limit=0, window=60, reason_code=None, enforce=True):
        self.key = key
        # maximum number of events in the given window, 0 indicates "no limit"
        self.limit = limit
        # time in seconds that this quota reflects
        self.window = window
        # a machine readable string
        self.reason_code = reason_code
        # should this quota be hard-enforced (or just tracked)
        self.enforce = enforce


class RedisQuota(Quota):
    #: The ``grace`` period allows accomodating for clock drift in TTL
    #: calculation since the clock on the Redis instance used to store quota
    #: metrics may not be in sync with the computer running this code.
    grace = 60

    def __init__(self, **options):
        self.cluster, options = get_cluster_from_options('SENTRY_QUOTA_OPTIONS', options)
        super(RedisQuota, self).__init__(**options)
        self.namespace = 'quota'

    def validate(self):
        try:
            with self.cluster.all() as client:
                client.ping()
        except Exception as e:
            raise InvalidConfiguration(six.text_type(e))

    def __get_redis_key(self, key, timestamp, interval, shift):
        return '{}:{}:{}'.format(
            self.namespace,
            key,
            int((timestamp - shift) // interval),
        )

    def get_quotas_with_limits(self, project, key=None):
        return [
            quota for quota in self.get_quotas(project, key=key)
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
                key='p:{}'.format(project.id),
                limit=pquota[0],
                window=pquota[1],
                reason_code='project_quota',
            ),
            BasicRedisQuota(
                key='o:{}'.format(project.organization_id),
                limit=oquota[0],
                window=oquota[1],
                reason_code='org_quota',
            ),
        ]
        if key:
            kquota = self.get_key_quota(key)
            results.append(
                BasicRedisQuota(
                    key='k:{}'.format(key.id),
                    limit=kquota[0],
                    window=kquota[1],
                    reason_code='key_quota',
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
                quota.key, timestamp, quota.window, organization_id % quota.window
            )
            refund_key = self.get_refunded_quota_key(key)

            return (client.get(key), client.get(refund_key))

        def get_value_for_result(result, refund_result):
            if result is None:
                return None

            return int(result.value or 0) - int(refund_result.value or 0)

        with self.cluster.fanout() as client:
            results = map(
                functools.partial(
                    get_usage_for_quota,
                    client.target_key(
                        six.text_type(organization_id),
                    ),
                ),
                quotas,
            )

        return [
            get_value_for_result(*r) for r in results
        ]

    def get_refunded_quota_key(self, key):
        return 'r:{}'.format(key)

    def refund(self, project, key=None, timestamp=None):
        if timestamp is None:
            timestamp = time()

        quotas = self.get_quotas_with_limits(project, key=key)

        if not quotas:
            return

        client = self.cluster.get_local_client_for_key(six.text_type(project.organization_id))
        pipe = client.pipeline()

        for quota in quotas:
            shift = project.organization_id % quota.window
            # kind of arbitrary, but seems like we don't want this to expire til we're
            # sure the window is over?
            expiry = self.get_next_period_start(quota.window, shift, timestamp) + self.grace
            return_key = self.get_refunded_quota_key(
                self.__get_redis_key(quota.key, timestamp, quota.window, shift),
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
            key = self.__get_redis_key(quota.key, timestamp, quota.window, shift)
            return_key = self.get_refunded_quota_key(key)
            keys.extend((key, return_key))
            expiry = self.get_next_period_start(quota.window, shift, timestamp) + self.grace
            args.extend((quota.limit, int(expiry)))

        client = self.cluster.get_local_client_for_key(six.text_type(project.organization_id))
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
                return RateLimited(
                    retry_after=worst_case[0],
                    reason_code=worst_case[1],
                )
        return NotRateLimited()

"""
sentry.quotas.redis
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from time import time

from sentry.exceptions import InvalidConfiguration
from sentry.quotas.base import NotRateLimited, Quota, RateLimited
from sentry.utils.redis import get_cluster_from_options, load_script

is_rate_limited = load_script('quotas/is_rate_limited.lua')


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
            raise InvalidConfiguration(unicode(e))

    def get_quotas(self, project):
        return (
            ('p:{}'.format(project.id), self.get_project_quota(project), 60),
            ('o:{}'.format(project.organization.id), self.get_organization_quota(project.organization), 60),
        )

    def get_redis_key(self, key, timestamp, interval):
        return '{}:{}:{}'.format(self.namespace, key, int(timestamp // interval))

    def is_rate_limited(self, project):
        timestamp = time()

        quotas = filter(
            lambda (key, limit, interval): limit and limit > 0,  # a zero limit means "no limit", not "reject all"
            self.get_quotas(project),
        )

        # If there are no quotas to actually check, skip the trip to the database.
        if not quotas:
            return NotRateLimited

        def get_next_period_start(interval):
            """Return the timestamp when the next rate limit period begins for an interval."""
            return ((timestamp // interval) + 1) * interval

        keys = []
        args = []
        for key, limit, interval in quotas:
            keys.append(self.get_redis_key(key, timestamp, interval))
            expiry = get_next_period_start(interval) + self.grace
            args.extend((limit, int(expiry)))

        client = self.cluster.get_local_client_for_key(str(project.organization.pk))
        rejections = is_rate_limited(client, keys, args)
        if any(rejections):
            delay = max(get_next_period_start(interval) - timestamp for (key, limit, interval), rejected in zip(quotas, rejections) if rejected)
            return RateLimited(retry_after=delay)
        else:
            return NotRateLimited

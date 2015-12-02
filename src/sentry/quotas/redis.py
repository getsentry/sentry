"""
sentry.quotas.redis
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import time

from django.conf import settings
from redis.client import Script

from sentry.exceptions import InvalidConfiguration
from sentry.quotas.base import Quota, RateLimited, NotRateLimited
from sentry.utils.redis import make_rb_cluster


# Check a collection of quota counters to identify if an item should be rate
# limited. Values provided as ``KEYS`` specify the keys of the counters to
# check, and values provided as ``ARGV`` specify the maximum value (quota
# limit) and expiration time for each key.
#
# For example, to check a quota ``foo`` that has a limit of 10 items and
# expires at the Unix timestamp ``100``, as well as a quota ``bar`` that has a
# limit of 20 items and should expire at the Unix timestamp ``200``, the
# ``KEYS`` and ``ARGV`` values would be as follows:
#
#   KEYS = {"foo", "bar"}
#   ARGV = {10, 100, 20, 100}
#
# If all checks pass (the item is accepted), the counters for all quotas are
# incremented. If any checks fail (the item is rejected), the counters for all
# quotas are unaffected. The result is a Lua table/array (Redis multi bulk
# reply) that specifies whether or not the item was *rejected* based on the
# provided limit.
IS_RATE_LIMITED_SCRIPT = """\
assert(#KEYS * 2 == #ARGV, "incorrect number of keys and arguments provided")

local results = {}
local failed = false
for i=1,#KEYS do
    local limit = tonumber(ARGV[(i * 2) - 1])
    local rejected = (redis.call('GET', KEYS[i]) or 0) + 1 > limit
    if rejected then
        failed = true
    end
    results[i] = rejected
end

if not failed then
    for i=1,#KEYS do
        redis.call('INCR', KEYS[i])
        redis.call('EXPIREAT', KEYS[i], ARGV[i * 2])
    end
end

return results
"""

is_rate_limited = Script(None, IS_RATE_LIMITED_SCRIPT)


class RedisQuota(Quota):
    #: The ``interval`` specifies the size of a quota window in seconds.
    interval = 60

    #: The ``grace`` period allows accomodating for clock drift in TTL
    #: calculation since the clock on the Redis instance used to store quota
    #: metrics may not be in sync with the computer running this code.
    grace = 60

    def __init__(self, **options):
        if not options:
            # inherit default options from REDIS_OPTIONS
            options = settings.SENTRY_REDIS_OPTIONS
        super(RedisQuota, self).__init__(**options)
        options.setdefault('hosts', {0: {}})
        self.cluster = make_rb_cluster(options['hosts'])

    def validate(self):
        try:
            with self.cluster.all() as client:
                client.ping()
        except Exception as e:
            raise InvalidConfiguration(unicode(e))

    def _get_quotas(self, project, timestamp):
        return filter(
            lambda (key, value): value > 0,  # a zero quota means "no quota"
            (
                (self._get_project_key(project, timestamp), self.get_project_quota(project)),
                (self._get_organization_key(project.organization, timestamp), self.get_organization_quota(project.organization)),
            )
        )

    def is_rate_limited(self, project):
        timestamp = time.time()

        # If there are no quotas to actually check, skip the trip to the database.
        quotas = self._get_quotas(project, timestamp)
        if not quotas:
            return NotRateLimited

        # interval start + duration + grace period
        expiry = ((timestamp // self.interval) * self.interval) + self.interval + self.grace

        keys = []
        args = []
        for key, limit in quotas:
            keys.append(keys)
            args.extend((limit, expiry))

        client = self.cluster.get_local_client_for_key(str(project.organization.pk))
        if any(is_rate_limited(keys, args, client=client)):
            return RateLimited(retry_after=self.get_time_remaining())
        else:
            return NotRateLimited

    def get_time_remaining(self):
        # interval start + duration - current time
        timestamp = time.time()
        return ((timestamp // self.interval) * self.interval) + self.interval - timestamp

    def _get_project_key(self, project, timestamp):
        return 'quota:p:%s:%s' % (project.id, timestamp // self.interval)

    def _get_organization_key(self, organization, timestamp):
        return 'quota:o:%s:%s' % (organization.id, timestamp // self.interval)

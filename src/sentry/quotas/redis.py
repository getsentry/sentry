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
# limit) for the key at the same array index. (``KEYS`` and ``ARGV`` must be
# the same length.) If all checks pass (the item is accepted), all counters are
# incremented. If any checks fail (the item is rejected), all counters are
# unaffected. The result is a Lua table/array (Redis multi bulk reply) that
# specifies whether or not the item was *rejected* based on the provided limit.
IS_RATE_LIMITED_SCRIPT = """\
assert(#KEYS == #ARGV, "unequal number of keys and arguments provided")

local results = {}
local failed = false
for i=1,#ARGV do
    local rejected = (redis.call('GET', KEYS[i]) or 0) + 1 > tonumber(ARGV[i])
    if rejected then
        failed = true
    end
    results[i] = rejected
end

if not failed then
    for i=1,#ARGV do
        redis.call('INCR', KEYS[i])
    end
end

return results
"""

is_rate_limited = Script(None, IS_RATE_LIMITED_SCRIPT)


class RedisQuota(Quota):
    ttl = 60

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

    def _get_quotas(self, project):
        return filter(
            lambda (key, value): value > 0,  # a zero quota means "no quota"
            (
                (self._get_team_key(project.team), self.get_team_quota(project.team)),
                (self._get_project_key(project), self.get_project_quota(project)),
                (self._get_organization_key(project.organization), self.get_organization_quota(project.organization)),
            )
        )

    def is_rate_limited(self, project):
        # If there are no quotas to actually check, skip the trip to the database.
        quotas = self._get_quotas(project)
        if not quotas:
            return NotRateLimited

        keys, args = zip(*quotas)
        client = self.cluster.get_local_client_for_key(self._get_organization_key(project.organization))
        if any(is_rate_limited(keys, args, client=client)):
            return RateLimited(retry_after=self.get_time_remaining())
        else:
            return NotRateLimited

    def get_time_remaining(self):
        return int(self.ttl - (time.time() - int(time.time() / self.ttl) * self.ttl))

    def _get_team_key(self, team):
        return 'quota:t:%s:%s' % (team.id, int(time.time() / self.ttl))

    def _get_project_key(self, project):
        return 'quota:p:%s:%s' % (project.id, int(time.time() / self.ttl))

    def _get_organization_key(self, organization):
        return 'quota:o:%s:%s' % (organization.id, int(time.time() / self.ttl))

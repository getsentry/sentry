from __future__ import absolute_import


class RateLimiter(object):
    def is_limited(self, project, key, limit):
        return False

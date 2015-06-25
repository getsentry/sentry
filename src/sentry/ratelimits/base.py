from __future__ import absolute_import


class RateLimiter(object):
    __all__ = ('is_limited',)

    def is_limited(self, project, key, limit):
        return False

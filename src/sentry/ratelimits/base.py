from __future__ import absolute_import


class RateLimiter(object):
    window = 60

    def validate(self):
        """
        Validates the settings for this backend (i.e. such as proper connection
        info).

        Raise ``InvalidConfiguration`` if there is a configuration error.
        """

    def is_limited(self, key, limit, project=None, window=None):
        return False

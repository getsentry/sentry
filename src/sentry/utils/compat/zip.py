from __future__ import absolute_import

from sentry.utils.compat import zip as _zip

zip = lambda x: list(_zip(x))  # NOQA

from __future__ import absolute_import

from sentry.utils.compat import filter as _filter

filter = lambda x: list(_filter(x))  # NOQA

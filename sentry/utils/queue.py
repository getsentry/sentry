"""
sentry.utils.queue
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from sentry.conf import settings


def maybe_delay(func, *args, **kwargs):
    if settings.USE_QUEUE:
        return func.delay(*args, **kwargs)
    return func(*args, **kwargs)


def maybe_async(func, args=None, kwargs=None, *fargs, **fkwargs):
    if args is None:
        args = []
    if kwargs is None:
        kwargs = {}
    if settings.USE_QUEUE:
        return func.apply_async(args=args, kwargs=kwargs, *fargs, **fkwargs)
    return func(*args, **kwargs)

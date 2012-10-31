"""
sentry.utils.queue
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from sentry.conf import settings


def can_queue(func):
    """
    Returns a boolean describing if func should be passed through the queueing
    infrastructure based on the ``USE_QUEUE`` setting.

    >>> can_queue(task_func)
    True
    """
    if not settings.USE_QUEUE:
        return False
    elif settings.USE_QUEUE is True:
        return True
    elif '%s.%s' % (func.__module__, func.__name__) in settings.USE_QUEUE:
        return True
    return False


def maybe_delay(func, *args, **kwargs):
    if can_queue(func):
        return func.delay(*args, **kwargs)
    return func(*args, **kwargs)


def maybe_async(func, args=None, kwargs=None, *fargs, **fkwargs):
    if args is None:
        args = []
    if kwargs is None:
        kwargs = {}
    if can_queue(func):
        return func.apply_async(args=args, kwargs=kwargs, *fargs, **fkwargs)
    return func(*args, **kwargs)

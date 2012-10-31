"""
sentry.utils.safe
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import logging

from django.db import transaction


def safe_execute(func, *args, **kwargs):
    sid = transaction.savepoint()
    try:
        result = func(*args, **kwargs)
    except Exception, e:
        transaction.savepoint_rollback(sid)
        if hasattr(func, 'im_class'):
            cls = func.im_class
        else:
            cls = func.__class__
        logger = logging.getLogger('sentry.plugins')
        logger.error('Error processing %r on %r: %s', func.__name__, cls.__name__, e, extra={
            'func_module': cls.__module__,
            'func_args': args,
            'func_kwargs': kwargs,
        }, exc_info=True)
    else:
        transaction.savepoint_commit(sid)
        return result

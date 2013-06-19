"""
sentry.utils.safe
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import logging

from django.db import transaction

from sentry.constants import MAX_VARIABLE_SIZE, MAX_DICTIONARY_ITEMS
from sentry.utils.strings import truncatechars


def safe_execute(func, *args, **kwargs):
    try:
        result = func(*args, **kwargs)
    except Exception, e:
        transaction.rollback_unless_managed()
        if hasattr(func, 'im_class'):
            cls = func.im_class
        else:
            cls = func.__class__
        logger = logging.getLogger('sentry.errors.plugins')
        logger.error('Error processing %r on %r: %s', func.__name__, cls.__name__, e, extra={
            'func_module': cls.__module__,
            'func_args': args,
            'func_kwargs': kwargs,
        }, exc_info=True)
    else:
        return result


def trim(value, max_size=MAX_VARIABLE_SIZE, max_depth=3, _depth=0, _size=0, **kwargs):
    """
    Truncates a value to ```MAX_VARIABLE_SIZE```.

    The method of truncation depends on the type of value.
    """
    options = {
        'max_depth': max_depth,
        'max_size': max_size,
        '_depth': _depth + 1,
    }

    if _depth > max_depth:
        return trim(repr(value), _size=_size, max_size=max_size)

    elif isinstance(value, dict):
        result = {}
        _size += 2
        for k, v in value.iteritems():
            trim_v = trim(v, _size=_size, **options)
            result[k] = trim_v
            _size += len(unicode(trim_v)) + 1
            if _size >= max_size:
                break

    elif isinstance(value, (list, tuple)):
        result = []
        _size += 2
        for v in value:
            trim_v = trim(v, _size=_size, **options)
            result.append(trim_v)
            _size += len(unicode(trim_v))
            if _size >= max_size:
                break

    elif isinstance(value, basestring):
        result = truncatechars(value, max_size - _size)

    else:
        result = value

    return result


def trim_dict(value, max_items=MAX_DICTIONARY_ITEMS, **kwargs):
    max_items -= 1
    for idx, key in enumerate(value.keys()):
        value[key] = trim(value[key], **kwargs)
        if idx > max_items:
            del value[key]

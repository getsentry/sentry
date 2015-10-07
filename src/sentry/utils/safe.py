"""
sentry.utils.safe
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import logging
import six

from django.conf import settings
from django.db import transaction

from sentry.utils.strings import truncatechars


def safe_execute(func, *args, **kwargs):
    # TODO: we should make smart savepoints (only executing the savepoint server
    # side if we execute a query)
    _with_transaction = kwargs.pop('_with_transaction', True)
    try:
        if _with_transaction:
            with transaction.atomic():
                result = func(*args, **kwargs)
        else:
            result = func(*args, **kwargs)
    except Exception as exc:
        if hasattr(func, 'im_class'):
            cls = func.im_class
        else:
            cls = func.__class__

        func_name = getattr(func, '__name__', str(func))
        cls_name = cls.__name__

        logger = logging.getLogger('sentry.safe')
        logger.error(
            'Error processing %r on %r: %s', func_name, cls_name, exc,
            exc_info=True,
        )
    else:
        return result


def trim(value, max_size=settings.SENTRY_MAX_VARIABLE_SIZE, max_depth=3,
         object_hook=None, _depth=0, _size=0, **kwargs):
    """
    Truncates a value to ```MAX_VARIABLE_SIZE```.

    The method of truncation depends on the type of value.
    """
    options = {
        'max_depth': max_depth,
        'max_size': max_size,
        'object_hook': object_hook,
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
            _size += len(six.text_type(trim_v)) + 1
            if _size >= max_size:
                break

    elif isinstance(value, (list, tuple)):
        result = []
        _size += 2
        for v in value:
            trim_v = trim(v, _size=_size, **options)
            result.append(trim_v)
            _size += len(six.text_type(trim_v))
            if _size >= max_size:
                break

    elif isinstance(value, six.string_types):
        result = truncatechars(value, max_size - _size)

    else:
        result = value

    if object_hook is None:
        return result
    return object_hook(result)


def trim_pairs(iterable, max_items=settings.SENTRY_MAX_DICTIONARY_ITEMS, **kwargs):
    max_items -= 1
    result = []
    for idx, item in enumerate(iterable):
        key, value = item
        result.append((key, trim(value, **kwargs)))
        if idx > max_items:
            return result
    return result


def trim_dict(value, max_items=settings.SENTRY_MAX_DICTIONARY_ITEMS, **kwargs):
    max_items -= 1
    for idx, key in enumerate(value.keys()):
        value[key] = trim(value[key], **kwargs)
        if idx > max_items:
            del value[key]
    return value

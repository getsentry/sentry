"""
sentry.utils.safe
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import collections
import logging
import six

from django.conf import settings
from django.db import transaction
from django.utils.encoding import force_text

from sentry.utils import json
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
    except Exception as e:
        if hasattr(func, 'im_class'):
            cls = func.im_class
        else:
            cls = func.__class__

        func_name = getattr(func, '__name__', six.text_type(func))
        cls_name = cls.__name__

        logger = logging.getLogger('sentry.safe.%s' % (cls_name.lower(), ))
        logger.error('%s.process_error', func_name, exc_info=True, extra={'exception': e})
    else:
        return result


def trim(
    value,
    max_size=settings.SENTRY_MAX_VARIABLE_SIZE,
    max_depth=6,
    object_hook=None,
    _depth=0,
    _size=0,
    **kwargs
):
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
        if not isinstance(value, six.string_types):
            value = json.dumps(value)
        return trim(value, _size=_size, max_size=max_size)

    elif isinstance(value, dict):
        result = {}
        _size += 2
        for k in sorted(value.keys()):
            v = value[k]
            trim_v = trim(v, _size=_size, **options)
            result[k] = trim_v
            _size += len(force_text(trim_v)) + 1
            if _size >= max_size:
                break

    elif isinstance(value, (list, tuple)):
        result = []
        _size += 2
        for v in value:
            trim_v = trim(v, _size=_size, **options)
            result.append(trim_v)
            _size += len(force_text(trim_v))
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
    for idx, key in enumerate(list(iter(value))):
        value[key] = trim(value[key], **kwargs)
        if idx > max_items:
            del value[key]
    return value


def get_path(data, path, default=None):
    """
    Looks up a path of properties in a nested dictionary safely.
    Returns the value at the final level, or the default value if
    property lookup failed at any step in the path.
    """
    if not isinstance(path, (list, tuple)) or len(path) == 0:
        raise ValueError
    for p in path:
        if not isinstance(data, collections.Mapping) or p not in data:
            return default
        data = data[p]
    return data

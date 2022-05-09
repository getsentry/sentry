import logging
from typing import Any, Mapping, Sequence, Union

import sentry_sdk
from django.conf import settings
from django.db import transaction
from django.utils.encoding import force_text
from django.utils.http import urlencode

from sentry.utils import json
from sentry.utils.compat import filter
from sentry.utils.strings import truncatechars

PathSearchable = Union[Mapping[str, Any], Sequence[Any]]


def safe_execute(func, *args, **kwargs):
    # TODO: we should make smart savepoints (only executing the savepoint server
    # side if we execute a query)
    _with_transaction = kwargs.pop("_with_transaction", True)
    expected_errors = kwargs.pop("expected_errors", None)
    try:
        if _with_transaction:
            with sentry_sdk.start_span(op="db.safe_execute", description="transaction.atomic"):
                with transaction.atomic():
                    result = func(*args, **kwargs)
        else:
            result = func(*args, **kwargs)
    except Exception as e:
        if hasattr(func, "im_class"):
            cls = func.im_class
        else:
            cls = func.__class__

        func_name = getattr(func, "__name__", str(func))
        cls_name = cls.__name__
        logger = logging.getLogger(f"sentry.safe.{cls_name.lower()}")

        if expected_errors and isinstance(e, expected_errors):
            logger.info("%s.process_error_ignored", func_name, extra={"exception": e})
            return
        logger.error("%s.process_error", func_name, exc_info=True, extra={"exception": e})
    else:
        return result


def trim(
    value,
    max_size=settings.SENTRY_MAX_VARIABLE_SIZE,
    max_depth=6,
    object_hook=None,
    _depth=0,
    _size=0,
    **kwargs,
):
    """
    Truncates a value to ```MAX_VARIABLE_SIZE```.

    The method of truncation depends on the type of value.
    """
    options = {
        "max_depth": max_depth,
        "max_size": max_size,
        "object_hook": object_hook,
        "_depth": _depth + 1,
    }

    if _depth > max_depth:
        if not isinstance(value, str):
            value = json.dumps(value)
        return trim(value, _size=_size, max_size=max_size)

    elif isinstance(value, dict):
        result = {}
        _size += 2
        for k in sorted(value.keys(), key=lambda x: (len(force_text(value[x])), x)):
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
        if isinstance(value, tuple):
            result = tuple(result)

    elif isinstance(value, str):
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


def get_path(data: PathSearchable, *path, **kwargs):
    """
    Safely resolves data from a recursive data structure. A value is only
    returned if the full path exists, otherwise ``None`` is returned.

    If the ``default`` argument is specified, it is returned instead of ``None``.

    If the ``filter`` argument is specified and the value is a list, it is
    filtered with the given callback. Alternatively, pass ``True`` as filter to
    only filter ``None`` values.
    """
    default = kwargs.pop("default", None)
    f = kwargs.pop("filter", None)
    for k in kwargs:
        raise TypeError("get_path() got an undefined keyword argument '%s'" % k)

    for p in path:
        if isinstance(data, Mapping) and p in data:
            data = data[p]
        elif isinstance(data, (list, tuple)) and isinstance(p, int) and -len(data) <= p < len(data):
            data = data[p]
        else:
            return default

    if f and data and isinstance(data, (list, tuple)):
        data = filter((lambda x: x is not None) if f is True else f, data)

    return data if data is not None else default


def set_path(data, *path, **kwargs):
    """
    Recursively traverses or creates the specified path and sets the given value
    argument. `None` is treated like a missing value. If a non-mapping item is
    encountered while traversing, the value is not set.

    This function is equivalent to a recursive dict.__setitem__. Returns True if
    the value was set, otherwise False.

    If the ``overwrite` kwarg is set to False, the value is only set if there is
    no existing value or it is None. See ``setdefault_path``.
    """

    try:
        value = kwargs.pop("value")
    except KeyError:
        raise TypeError("set_path() requires a 'value' keyword argument")

    overwrite = kwargs.pop("overwrite", True)
    for k in kwargs:
        raise TypeError("set_path() got an undefined keyword argument '%s'" % k)

    for p in path[:-1]:
        if not isinstance(data, Mapping):
            return False
        if data.get(p) is None:
            data[p] = {}
        data = data[p]

    if not isinstance(data, Mapping):
        return False

    p = path[-1]
    if overwrite or data.get(p) is None:
        data[p] = value
        return True

    return False


def setdefault_path(data, *path, **kwargs):
    """
    Recursively traverses or creates the specified path and sets the given value
    argument if it does not exist. `None` is treated like a missing value. If a
    non-mapping item is encountered while traversing, the value is not set.

    This function is equivalent to a recursive dict.setdefault, except for None
    values. Returns True if the value was set, otherwise False.
    """
    kwargs["overwrite"] = False
    return set_path(data, *path, **kwargs)


def safe_urlencode(query, **kwargs):
    """
    django.utils.http.urlencode wrapper that replaces query parameter values
    of None with empty string so that urlencode doesn't raise TypeError
    "Cannot encode None in a query string".
    """
    # sequence of 2-element tuples
    if isinstance(query, (list, tuple)):
        safe_query = ((pair[0], "" if pair[1] is None else pair[1]) for pair in query)
        return urlencode(safe_query, **kwargs)

    if isinstance(query, dict):
        safe_query = {k: "" if v is None else v for k, v in query.items()}
        return urlencode(safe_query, **kwargs)

    return urlencode(query, **kwargs)

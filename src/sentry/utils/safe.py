import logging
from collections.abc import Callable, Mapping, MutableMapping, Sequence
from typing import Any, ParamSpec, TypeVar, Union

from django.conf import settings
from django.utils.encoding import force_str
from django.utils.http import urlencode

from sentry.utils import json
from sentry.utils.strings import truncatechars

PathSearchable = Union[Mapping[str, Any], Sequence[Any], None]

P = ParamSpec("P")
R = TypeVar("R")


def safe_execute(func: Callable[P, R], *args: P.args, **kwargs: P.kwargs) -> R | None:
    try:
        result = func(*args, **kwargs)
    except Exception as e:
        if hasattr(func, "im_class"):
            cls = func.im_class
        else:
            cls = func.__class__

        func_name = getattr(func, "__name__", str(func))
        cls_name = cls.__name__
        logger = logging.getLogger(f"sentry.safe.{cls_name.lower()}")

        logger.exception("%s.process_error", func_name, extra={"exception": e})
        return None
    else:
        return result


def trim(
    value,
    max_size=settings.SENTRY_MAX_VARIABLE_SIZE,
    max_depth=6,
    _depth=0,
    _size=0,
):
    """
    Truncates a value to ```MAX_VARIABLE_SIZE```.

    The method of truncation depends on the type of value.
    """
    options = {
        "max_depth": max_depth,
        "max_size": max_size,
        "_depth": _depth + 1,
    }

    if _depth > max_depth:
        if not isinstance(value, str):
            value = json.dumps(value)
        return trim(value, _size=_size, max_size=max_size)

    elif isinstance(value, dict):
        result: Any = {}
        _size += 2
        for k in sorted(value.keys(), key=lambda x: (len(force_str(value[x])), x)):
            v = value[k]
            trim_v = trim(v, _size=_size, **options)
            result[k] = trim_v
            _size += len(force_str(trim_v)) + 1
            if _size >= max_size:
                break

    elif isinstance(value, (list, tuple)):
        result = []
        _size += 2
        for v in value:
            trim_v = trim(v, _size=_size, **options)
            result.append(trim_v)
            _size += len(force_str(trim_v))
            if _size >= max_size:
                break
        if isinstance(value, tuple):
            result = tuple(result)

    elif isinstance(value, str):
        result = truncatechars(value, max_size - _size)

    else:
        result = value

    return result


def get_path(data: PathSearchable, *path, should_log=False, **kwargs):
    """
    Safely resolves data from a recursive data structure. A value is only
    returned if the full path exists, otherwise ``None`` is returned.

    If the ``default`` argument is specified, it is returned instead of ``None``.

    If the ``filter`` argument is specified and the value is a list, it is
    filtered with the given callback. Alternatively, pass ``True`` as filter to
    only filter ``None`` values.
    """
    logger = logging.getLogger(__name__)
    default = kwargs.pop("default", None)
    f: bool | None = kwargs.pop("filter", None)
    for k in kwargs:
        raise TypeError("get_path() got an undefined keyword argument '%s'" % k)

    logger_data = {}
    if should_log:
        logger_data = {
            "path_searchable": json.dumps(data),
            "path_arg": json.dumps(path),
        }

    for p in path:
        if isinstance(data, Mapping) and p in data:
            data = data[p]
        elif isinstance(data, (list, tuple)) and isinstance(p, int) and -len(data) <= p < len(data):
            data = data[p]
        else:
            if should_log:
                logger_data["invalid_path"] = json.dumps(p)
                logger.info("sentry.safe.get_path.invalid_path_section", extra=logger_data)
            return default

    if should_log:
        if data is None:
            logger.info("sentry.safe.get_path.iterated_path_is_none", extra=logger_data)
        else:
            logger_data["iterated_path"] = json.dumps(data)

    if f and data and isinstance(data, (list, tuple)):
        data = list(filter((lambda x: x is not None) if f is True else f, data))
        if should_log and len(data) == 0 and "iterated_path" in logger_data:
            logger.info("sentry.safe.get_path.filtered_path_is_none", extra=logger_data)

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
        if not isinstance(data, MutableMapping):
            return False
        if data.get(p) is None:
            data[p] = {}
        data = data[p]

    if not isinstance(data, MutableMapping):
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
        query_seq = ((pair[0], "" if pair[1] is None else pair[1]) for pair in query)
        return urlencode(query_seq, **kwargs)
    elif isinstance(query, dict):
        query_d = {k: "" if v is None else v for k, v in query.items()}
        return urlencode(query_d, **kwargs)
    else:
        return urlencode(query, **kwargs)

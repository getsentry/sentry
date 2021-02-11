import inspect
from threading import local
import re

from hashlib import md5

from django.utils.encoding import force_bytes

from sentry.utils.safe import get_path
from sentry.stacktraces.processing import get_crash_frame_from_event_data

from typing import Any, TypeVar, Callable, Union, Generator, Iterator

_R = TypeVar("_R")


_fingerprint_var_re = re.compile(r"\{\{\s*(\S+)\s*\}\}")


def parse_fingerprint_var(value):
    match = _fingerprint_var_re.match(value)
    if match is not None and match.end() == len(value):
        return match.group(1)


def is_default_fingerprint_var(value):
    return parse_fingerprint_var(value) == "default"


def hash_from_values(values):
    result = md5()
    for value in values:
        result.update(force_bytes(value, errors="replace"))
    return result.hexdigest()


def get_rule_bool(value):
    if value:
        value = value.lower()
        if value in ("1", "yes", "true"):
            return True
        elif value in ("0", "no", "false"):
            return False


def get_fingerprint_value(var, data):
    if var == "transaction":
        return data.get("transaction") or "<no-transaction>"
    elif var == "message":
        message = (
            get_path(data, "logentry", "formatted")
            or get_path(data, "logentry", "message")
            or get_path(data, "exception", "values", -1, "value")
        )
        return message or "<no-message>"
    elif var in ("type", "error.type"):
        ty = get_path(data, "exception", "values", -1, "type")
        return ty or "<no-type>"
    elif var in ("value", "error.value"):
        value = get_path(data, "exception", "values", -1, "value")
        return value or "<no-value>"
    elif var in ("function", "stack.function"):
        frame = get_crash_frame_from_event_data(data)
        func = frame.get("function") if frame else None
        return func or "<no-function>"
    elif var in ("path", "stack.abs_path"):
        frame = get_crash_frame_from_event_data(data)
        func = frame.get("abs_path") or frame.get("filename") if frame else None
        return func or "<no-abs-path>"
    elif var == "stack.filename":
        frame = get_crash_frame_from_event_data(data)
        func = frame.get("filename") or frame.get("abs_path") if frame else None
        return func or "<no-filename>"
    elif var in ("module", "stack.module"):
        frame = get_crash_frame_from_event_data(data)
        mod = frame.get("module") if frame else None
        return mod or "<no-module>"
    elif var in ("package", "stack.package"):
        frame = get_crash_frame_from_event_data(data)
        pkg = frame.get("package") if frame else None
        if pkg:
            pkg = pkg.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
        return pkg or "<no-package>"
    elif var == "level":
        return data.get("level") or "<no-level>"
    elif var == "logger":
        return data.get("logger") or "<no-logger>"
    elif var.startswith("tags."):
        tag = var[5:]
        for t, value in data.get("tags") or ():
            if t == tag:
                return value
        return "<no-value-for-tag-%s>" % tag


def resolve_fingerprint_values(values, event_data):
    def _get_fingerprint_value(value):
        var = parse_fingerprint_var(value)
        if var is None:
            return value
        rv = get_fingerprint_value(var, event_data)
        if rv is None:
            return value
        return rv

    return [_get_fingerprint_value(x) for x in values]


def expand_title_template(template, event_data):
    def _handle_match(match):
        var = match.group(1)
        rv = get_fingerprint_value(var, event_data)
        if rv is not None:
            return rv
        return match.group(0)

    return _fingerprint_var_re.sub(_handle_match, template)


_next_elem = local()


class StopParametrization(Exception):
    pass


def call_many_elements(
    f: Callable[..., Union[Generator[_R, None, None], _R]],
    *args: Any,
    **kwargs: Any,
) -> Iterator[_R]:
    orig_values = getattr(_next_elem, "values", {})
    _next_elem.values = {}

    rv = f(*args, **kwargs)

    if inspect.isgenerator(rv):
        yield from rv
    else:
        yield rv

        counter = 0

        while _next_elem.values:
            try:
                yield f(*args, **kwargs)
            except StopParametrization:
                break

            counter += 1

            if counter > 1000:
                raise RuntimeError("Infinite loop")

    _next_elem.values = orig_values


def call_single_element(
    f: Callable[..., Union[Generator[_R, None, None], _R]],
    *args: Any,
    call_id: Any = None,
    **kwargs: Any,
) -> _R:
    """
    Helper function for calling a function that makes the caller implicitly
    support generators. Everything is a matrix, like in Matlab!

    >>> def foo():
    ...     yield 2
    ...     yield 3

    >>> # alternative foo
    >>> def foo(): return 2
    >>> def bar(): return call_single_element(foo) * 2
    >>> assert list(call_many_elements(bar)) == [4, 6]
    """

    if call_id is None:
        call_id = f

    prev_call_id = getattr(_next_elem, "call_id", None)
    call_id = (prev_call_id, call_id)
    _next_elem.call_id = call_id

    try:
        # _next_elem.values needs to be initialized via call_many_elements
        if call_id in _next_elem.values:
            stored_items = _next_elem.values[call_id]
            if not stored_items:
                del _next_elem.values[call_id]
                raise StopParametrization()
            return stored_items.pop()

        items = f(*args, **kwargs)

        if inspect.isgenerator(items):
            items = list(items)
            if not items:
                raise StopParametrization()

            items.reverse()

            _next_elem.values[call_id] = items

            return items.pop()
        else:
            return items

    finally:
        _next_elem.call_id = prev_call_id

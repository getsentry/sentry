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


def strict_trim(
    value: Any,
    max_bytes: int = settings.SENTRY_MAX_VARIABLE_SIZE,
    max_recursion_depth: int = 6,
) -> Any:
    """
    Recursively trim a value so that the end result, once JSONified and ASCII-encoded, is at or
    below the given maximum byte size.

    Any values nested more deeply than `max_recursion_depth` will be stringified whole.

    Values nested inside of a list, tuple, or dictionary which end up trimmed all the way down to
    nothing are omitted entirely, rather than being included as empty values. This applies
    recursively, so for example:
        original value:                                             [["dogs"], ["are great"]]
    Assuming a limit too small for `[["dogs"], ["a..."]]`:
        naively trimmed value:                                      [["dogs"], [""]]
        value after omitting empty string:                          [["dogs"], []]
        final value, after omitting the now-empty second list:      [["dogs"]]
    This does not apply to values which start out empty, however - those are kept as is.

    Relatedly, no string is ever trimmed to a bare "...", since that carries no more of the original
    value than "" does. If there's no room for at least one character of the original alongside the
    ellipsis, the result is the empty string, and is therefore subject to the omission described
    above.

    Compared to `trim`, this implementation is stricter in three ways:
        - it includes key size when trimming dictionaries, which the original does not,
        - it never exceeds the given limit, whereas the original keeps the first item to push it
          over the limit, and
        - it trims based on the eventual ASCII-encoded and JSONified length, which in the case of
          non-ASCII characters can far exceed its Python string length.
    """
    trimmed, _ = _strict_trim_inner(
        value,
        incoming_budget=max_bytes,
        max_recursion_depth=max_recursion_depth,
        current_depth=0,
    )
    return trimmed


def get_json_bytes(value: Any) -> int:
    # Force the encoding before taking the length so that characters and bytes are 1-to-1. (For
    # ASCII characters they always are, but non-ASCII characters can take 4, 8, or even more bytes
    # to represent.)
    return len(json.dumps(value).encode("utf-8"))


def _strict_trim_inner(
    value_to_trim: Any,
    incoming_budget: int,
    max_recursion_depth: int,
    current_depth: int,
) -> tuple[Any, int]:
    current_budget = incoming_budget

    options = {
        "max_recursion_depth": max_recursion_depth,
        "current_depth": current_depth + 1,
    }

    # If we've gone as deep as we're going to go, just stringify whatever's left before continuing
    if current_depth > max_recursion_depth and not isinstance(value_to_trim, str):
        value_to_trim = json.dumps(value_to_trim)

    if isinstance(value_to_trim, dict):
        result: Any = {}
        current_budget -= 2  # 2 for the outer `{` and `}`
        sort_by_entry_size = lambda key: (
            # Doing string length here is less exact than jsonsifying, because it doesn't
            # encode/escape anything, but since it's just for comparison, it's fine to use the
            # faster string cast
            len(str(key)) + len(str(value_to_trim[key])),
            str(key),
        )
        sorted_keys = sorted(value_to_trim.keys(), key=sort_by_entry_size)
        for key in sorted_keys:
            # If there's already an entry in `result`, account for the comma between it and the
            # entry we're handling now
            maybe_comma_size = 1 if result else 0
            # If the key is already a string, JSONifying it won't add quotes around it, but if it's
            # not (if it's an int, for example), it will
            maybe_quotes_size = 2 if not isinstance(key, str) else 0
            colon_size = 1

            key_size = get_json_bytes(key)
            key_and_punctuation_size = key_size + maybe_comma_size + maybe_quotes_size + colon_size

            min_value_size = 1
            min_entry_size = key_and_punctuation_size + min_value_size

            if min_entry_size > current_budget:
                break

            orig_value = value_to_trim[key]
            trimmed_value, trimmed_value_size = _strict_trim_inner(
                orig_value,
                incoming_budget=current_budget - key_and_punctuation_size,
                **options,
            )
            full_entry_size = key_and_punctuation_size + trimmed_value_size

            # If we're either out of budget, or so close to being out of budget that all we can fit
            # is a value which has had all of its contents trimmed away, we're done
            if full_entry_size > current_budget or _was_emptied_by_trimming(
                orig_value, trimmed_value
            ):
                break
            else:
                result[key] = trimmed_value
                current_budget -= full_entry_size

    elif isinstance(value_to_trim, (list, tuple)):
        # Use a list to collect trimmed values, regardless of `value_to_trim`'s type, since tuples
        # are immutatble. If `value_to_trim` is in fact a tuple, we'll convert it back after we're
        # done adding elements to it.
        result = []
        current_budget -= 2  # Add 2 for the opening/closing brackets or parens

        for element in value_to_trim:
            # If there's already an element in `result`, account for the comma between it and the
            # element we're handling now
            maybe_comma_size = 1 if result else 0

            trimmed_element, trimmed_element_size = _strict_trim_inner(
                element,
                incoming_budget=current_budget - maybe_comma_size,
                **options,
            )
            full_element_size = trimmed_element_size + maybe_comma_size

            # If we're either out of budget, or so close to being out of budget that all we can fit
            # is a value which has had all of its contents trimmed away, we're done
            if full_element_size > current_budget or _was_emptied_by_trimming(
                element, trimmed_element
            ):
                break
            else:
                result.append(trimmed_element)
                current_budget -= full_element_size

        # Convert back to a tuple if that's `value_to_trim`'s original type
        if isinstance(value_to_trim, tuple):
            result = tuple(result)

    elif isinstance(value_to_trim, str):
        # Trim the string to something which jsonifies within our budget. (Because jsonifying also
        # escapes and encodes, the jsonified version of a string can end up longer - in some cases
        # much longer - than the string itself.)
        result = _trim_to_json_size(value_to_trim, current_budget)
        current_budget -= get_json_bytes(result)

    else:
        result = value_to_trim
        current_budget -= get_json_bytes(result)

    # We can derive `result`'s size by seeing how much of the budget we used up
    current_value_size = incoming_budget - current_budget
    return (result, current_value_size)


def _trim_single_element(
    element: Any,
    punctuation_size: int,
    current_budget: int,
    max_recursion_depth: int,
    current_depth: int,
) -> tuple[Any, int]:
    """
    Trim a sequence element to fit the remaining budget.

    Returns the trimmed element, along with its total size, including punctuation. If total size
    exceeds the current budget, or if trimming would remove all of the element's contents, a total
    size of 0 is returned instead, so we know not to add the element (or any others after it) to the
    final result.
    """
    trimmed_element, trimmed_element_size = _strict_trim_inner(
        element,
        incoming_budget=current_budget - punctuation_size,
        max_recursion_depth=max_recursion_depth,
        current_depth=current_depth,
    )
    full_element_size = trimmed_element_size + punctuation_size

    if full_element_size > current_budget or _was_emptied_by_trimming(element, trimmed_element):
        full_element_size = 0  # Signal to the caller to stop

    return (trimmed_element, full_element_size)


def _trim_key_value_pair(
    key: Any,
    orig_value: Any,
    punctuation_size: int,
    current_budget: int,
    max_recursion_depth: int,
    current_depth: int,
) -> tuple[Any, int]:
    """
    Trim the value of a key-value pair to fit the remaining budget.

    Used both for dictionary entries and for entries in a list of key-value pairs. Because the two
    shapes punctuate their entries differently, the caller is the one to supply the total size of
    the punctuation for the pair.

    The key is never trimmed, and the caller already has it, so returns just the trimmed value,
    along with the total size of the pair, including punctuation. If total pair size exceeds the
    current budget, or if trimming would remove all of the value's contents, a total pair size of 0
    is returned instead, so we know not to add the pair (or any others after it) to the final
    result.
    """
    key_size = get_json_bytes(key)
    key_and_punctuation_size = key_size + punctuation_size
    value_budget = current_budget - key_and_punctuation_size

    if value_budget <= 0:
        return (None, 0)  # Signal the caller to stop

    trimmed_value, trimmed_value_size = _strict_trim_inner(
        orig_value,
        incoming_budget=value_budget,
        max_recursion_depth=max_recursion_depth,
        current_depth=current_depth,
    )
    full_pair_size = key_and_punctuation_size + trimmed_value_size

    if full_pair_size > current_budget or _was_emptied_by_trimming(orig_value, trimmed_value):
        full_pair_size = 0  # Signal the caller to stop

    return (trimmed_value, full_pair_size)


def _is_empty_string_or_collection(value: Any) -> bool:
    return isinstance(value, (str, list, tuple, dict)) and len(value) == 0


def _was_emptied_by_trimming(orig_value: Any, trimmed_value: Any) -> bool:
    """
    Determine whether trimming reduced a non-empty string or collection to an empty one.

    This happens when there's just enough budget left to represent a value's container (its quotes,
    brackets, or parentheses) but not any of its contents, at which point there's no point in
    including the value in the trimmed result, since it carries no information.
    """
    # It can't have *become* empty if it started out that way
    if _is_empty_string_or_collection(orig_value):
        return False

    return _is_empty_string_or_collection(trimmed_value)


def _trim_to_json_size(string_to_trim: str, max_json_bytes: int) -> str:
    """
    Trim the given string, if necessary, such that when JSONified, it's no longer than the given max
    length.

    Any trimmed result ends in "...", and always includes at least one character of the original
    string. If there isn't room for both, the empty string is returned instead, since a bare "..."
    carries no more of the original value than "" does, at two and a half times the size.
    """
    if not string_to_trim:
        return ""

    # Handle the easy case, where the string is already short enough
    if get_json_bytes(string_to_trim) <= max_json_bytes:
        return string_to_trim

    # Also handle the degenerate trimming case, where there's not enough room for at least one
    # character of the original string alongside the trailing "...". (Non-ASCII characters require
    # multiple bytes to express, so this limit depends on what we have.)
    shortest_valid_result = string_to_trim[0] + "..."
    if max_json_bytes < get_json_bytes(shortest_valid_result):
        return ""

    # Now that we know we're going to have to trim, account for the "..." we'll add at the end
    max_json_bytes -= 3

    # Start by getting rid of the part we know we can't use - even with nothing but ASCII
    # characters, we'll never drop below one byte per character
    if len(string_to_trim) > max_json_bytes:
        string_to_trim = string_to_trim[:max_json_bytes]

    # Try jsonifying again, in case that was enough to get us under the limit
    if get_json_bytes(string_to_trim) <= max_json_bytes:
        return string_to_trim + "..."

    # Run a binary search to find the longest substring we can use
    lower_boundary = 0
    upper_boundary = len(string_to_trim)
    longest_okay_slice = ""

    while lower_boundary <= upper_boundary:
        slice_point = (lower_boundary + upper_boundary) // 2
        sliced = string_to_trim[:slice_point]

        # Our result can be at least this long - try going higher
        if get_json_bytes(sliced) <= max_json_bytes:
            longest_okay_slice = sliced
            lower_boundary = slice_point + 1
        # Too long - try a shorter slice
        else:
            upper_boundary = slice_point - 1

    return longest_okay_slice + "..."


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
    "Cannot encode None in a query string". Returns empty string if query
    itself is None.
    """
    if query is None:
        return ""
    # sequence of 2-element tuples
    if isinstance(query, (list, tuple)):
        query_seq = ((pair[0], "" if pair[1] is None else pair[1]) for pair in query)
        return urlencode(query_seq, **kwargs)
    elif isinstance(query, dict):
        query_d = {k: "" if v is None else v for k, v in query.items()}
        return urlencode(query_d, **kwargs)
    else:
        return urlencode(query, **kwargs)

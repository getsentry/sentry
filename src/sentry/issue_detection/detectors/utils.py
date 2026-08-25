import hashlib
import logging
import math
import re
import sys
from datetime import timedelta
from typing import Any, TypedDict
from urllib.parse import ParseResult, parse_qs, urlparse

from sentry.utils.http import is_valid_ip

from ..types import Span

logger = logging.getLogger("issue_detectors")


URL_WITH_BRACKETED_HOSTNAME_REGEX = re.compile(
    r"""
    ^
    # Scheme (`http`, `https`, `ftp`, `mailto`, `file`, etc). Everything before the `//` is optional
    # to handle the legacy case where it used to be left off to allow for both `http` and `https`
    # (before `https` was the default).
    ([a-z][a-z0-9+.-]{1,32}:)?//
    # The full hostname - everything between the `//` after the scheme and the `/` which marks the
    # start of the path
    (?P<full_hostname>
        # Zero or more non-bracket, non-slash, legal hostname characters
        [^\[\]/'"`\\<>{}|\^\s?#]*
        (?P<value_with_brackets>
            \[
            (?P<bracketed_value>
                # One or more such characters. Allows spaces in order to catch values like
                # `[Filtered UUID]` and `[REDACTED IP]`.
                [^\[\]/'"`\\<>{}|\^?#]+
            )
            \]
        )
        # Zero or more such characters
        [^\[\]/'"`\\<>{}|\^\s?#]* # Zero or more such characters
    )
    # The rest of the URL (path, query string, and fragment) is technically optional
    (
        /
        # Any number of copies of anything not globally invalid - slashes and brackets allowed now
        # that we've gotten to the path
        [^'"`\\<>{}|\^\s]*
        # Final character - must be both valid in general and allowable in the last spot (so no
        # trailing punctuation)
        [^'"`\\<>{}|\^\s.,;]
    )?
    """,
    re.IGNORECASE | re.VERBOSE,
)

# Regex for bracketed URL values, which can come from data scrubbing (things like `[Filtered]`,
# `[REDACTED]`, `[filtered UUID]`, etc.) or from parameterization (things like `[id]` and `[email]`)
BRACKETED_URL_PLACEHOLDER_REGEX = re.compile(
    r"""
    \[
    # Zero or more non-bracket valid URL characters. Allows spaces in order to catch values like
    # `[Filtered UUID]` and `[REDACTED IP]`.
    [^'"`\\<>{}|\^\[\]]{0,32}
    \]
    """,
    re.IGNORECASE | re.VERBOSE,
)

PARAMETERIZED_URL_REGEX = re.compile(
    r"""(?x)
    (?P<uuid>
        \b
            [0-9a-fA-F]{8}-
            [0-9a-fA-F]{4}-
            [0-9a-fA-F]{4}-
            [0-9a-fA-F]{4}-
            [0-9a-fA-F]{12}
        \b
    ) |
    (?P<hashlike>
        \b[0-9a-fA-F]{10}([0-9a-fA-F]{14})?([0-9a-fA-F]{8})?([0-9a-fA-F]{8})?\b
    ) |
    (?P<int>
        -\d+\b |
        \b\d+\b
    )
"""
)  # Adapted from message.py

FILE_EXTENSION_REGEX = re.compile(r"\.[a-z0-9]{2,6}$", re.I)

# Finds dash-separated UUIDs. (Without dashes will be caught by
# ASSET_HASH_REGEX).
UUID_REGEX = re.compile(r"[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}", re.I)
# Preserves filename in e.g. main.[hash].js, but includes number when chunks
# are numbered (e.g. 2.[hash].js, 3.[hash].js, etc).
CHUNK_HASH_REGEX = re.compile(r"(?:[0-9]+)?\.[a-f0-9]{8}\.chunk", re.I)
# Finds one or more trailing hashes before the final extension.
TRAILING_HASH_REGEX = re.compile(r"([-.])(?:[a-f0-9]{8,64}\.)+([a-z0-9]{2,6})$", re.I)
# Finds strictly numeric filenames.
NUMERIC_FILENAME_REGEX = re.compile(r"/[0-9]+(\.[a-z0-9]{2,6})$", re.I)
# Finds version numbers in the path or filename (v123, v1.2.3, etc).
VERSION_NUMBER_REGEX = re.compile(r"v[0-9]+(?:\.[0-9]+)*")
# Looks for anything hex hash-like, but with a larger min size than the
# above to limit false positives.
ASSET_HASH_REGEX = re.compile(r"[a-f0-9]{16,64}", re.I)


def get_total_span_duration(spans: list[Span]) -> float:
    "Given a list of spans, find the sum of the span durations in milliseconds"
    sum = 0.0
    for span in spans:
        sum += get_span_duration(span).total_seconds() * 1000
    return sum


def get_max_span_duration(spans: list[Span]) -> float:
    "Given a list of spans, return the duration of the longest span in milliseconds"
    return max([get_span_duration(span).total_seconds() * 1000 for span in spans])


def escape_transaction(transaction: str) -> str:
    transaction = re.sub(r'"', r"\"", transaction)
    transaction = re.sub(r"\*", r"\*", transaction)
    return transaction


def span_has_obfuscated_hostname(span: Span) -> bool:
    """
    Check if the span's URL has a hostname we can use for matching up request spans.

    If two spans have parameterized and/or scrubbed hostnames in their URLs (indicated by the
    presence of any non-IP bracketed value), it's impossible to tell if they originally pointed to
    the same domain. This presents an obvious problem in detectors where we do hostname matching, so
    we need to be able to recognize such spans so we can skip over them in those detectors.
    """
    url = get_url_from_span(span)
    bracketed_hostname_match = URL_WITH_BRACKETED_HOSTNAME_REGEX.search(url)

    # If there are no bracketed values, we can definitely use the hostname
    if not bracketed_hostname_match:
        return False

    # If there are brackets, we can still use the hostname as long as the bracketed value is a valid
    # IP address.
    maybe_ip = bracketed_hostname_match.group("bracketed_value")
    return not is_valid_ip(maybe_ip)


def safer_urlparse(url: str) -> ParseResult:
    """
    `urlparse`, but tolerant of hostnames which include bracketed values as a result of having been
    scrubbed and/or parameterized.

    `urlparse` reads `[...]` in a URL's hostname as an IPv6 literal and errors out if it isn't a
    valid IP. In cases where that happens, this temporarily strips the brackets for parsing, then
    restores them in the final result.

    Reraises parsing errors caused by other invalid URL patterns.
    """
    try:
        return urlparse(url)
    except ValueError:
        bracketed_hostname_match = URL_WITH_BRACKETED_HOSTNAME_REGEX.search(url)

        if bracketed_hostname_match:
            match_groups = bracketed_hostname_match.groupdict()
            orig_hostname = match_groups["full_hostname"]
            value_with_brackets = match_groups["value_with_brackets"]
            bracketed_value = match_groups["bracketed_value"]

            # Strip the brackets (and any spaces between them) and try parsing again
            debracketed_url = url.replace(
                value_with_brackets,
                bracketed_value.replace(" ", ""),
                # In case the same parameterization exists later in the URL, too, only replace the
                # one in the hostname
                count=1,
            )
            parsed = urlparse(debracketed_url)

            # Restore the original hostname value before returning the result
            return parsed._replace(netloc=orig_hostname)

        # If the problem isn't a bracketed hostname, reraise to surface the issue
        else:
            raise


# Creates a stable fingerprint for resource spans from their description (url), removing common cache busting tokens.
def fingerprint_resource_span(span: Span) -> str:
    url = safer_urlparse(span.get("description") or "")
    path = url.path
    path = UUID_REGEX.sub("*", path)
    path = CHUNK_HASH_REGEX.sub(".*.chunk", path)
    path = TRAILING_HASH_REGEX.sub("\\1*.\\2", path)
    path = NUMERIC_FILENAME_REGEX.sub("/*\\1", path)
    path = VERSION_NUMBER_REGEX.sub("*", path)
    path = ASSET_HASH_REGEX.sub("*", path)
    stripped_url = url._replace(path=path, query="").geturl()
    return hashlib.sha1(stripped_url.encode("utf-8")).hexdigest()


class ParameterizedUrl(TypedDict):
    url: str
    path_params: list[str]  # e.g. ["123", "abc123de-1024-4321-abcd-1234567890ab"]
    query_params: dict[str, list[str]]  # e.g. {"limit": "50", "offset": "100"}


def parameterize_url_with_result(url: str) -> ParameterizedUrl:
    """
    Given a URL, return the URL with parsed path and query parameters replaced with '*',
    a list of the path parameters, and a dict of the query parameters.
    """
    parsed_url = safer_urlparse(str(url))

    protocol_fragments = []
    if parsed_url.scheme:
        protocol_fragments.append(parsed_url.scheme)
        protocol_fragments.append("://")

    host_fragments = []
    for fragment in parsed_url.netloc.split("."):
        host_fragments.append(str(fragment))

    path_fragments = []
    path_params = []

    # If the path ends with a file extension, do not parameterize it.
    if FILE_EXTENSION_REGEX.search(parsed_url.path):
        path_fragments.append(parsed_url.path)
    else:
        for fragment in parsed_url.path.split("/"):
            # Treat bracketed placeholders as pre-parameterized values
            path_param = BRACKETED_URL_PLACEHOLDER_REGEX.search(
                fragment
            ) or PARAMETERIZED_URL_REGEX.search(fragment)
            if path_param:
                path_fragments.append("*")
                path_params.append(path_param.group())
            else:
                path_fragments.append(str(fragment))

    query = parse_qs(parsed_url.query)

    parameterized_url = "".join(
        [
            "".join(protocol_fragments),
            ".".join(host_fragments),
            "/".join(path_fragments),
            "?",
            "&".join(sorted([f"{key}=*" for key in query.keys()])),
        ]
    ).rstrip("?")

    return ParameterizedUrl(
        url=parameterized_url,
        path_params=path_params,
        query_params=query,
    )


def parameterize_url(url: str) -> str:
    return parameterize_url_with_result(url).get("url", "")


def fingerprint_http_spans(spans: list[Span]) -> str:
    """
    Fingerprints http spans based on their paramaterized paths, assumes all spans are http spans
    """

    url_paths = []
    for http_span in spans:
        url = get_url_from_span(http_span)
        if url:
            parametrized_url = parameterize_url(url)
            path = safer_urlparse(parametrized_url).path
            if path not in url_paths:
                url_paths.append(path)
    url_paths.sort()

    hashed_url_paths = hashlib.sha1(("-".join(url_paths)).encode("utf8")).hexdigest()
    return hashed_url_paths


def get_span_evidence_value(span: Span | None = None, include_op: bool = True) -> str:
    """Get the 'span evidence' data for a given span. This is displayed in issue alert emails."""
    value = "no value"
    if not span:
        return value

    op = (span.get("op") or "").strip()
    desc = (span.get("description") or "").strip()

    if not op and desc:
        value = desc
    elif not desc and op:
        value = op
    elif op and desc:
        value = f"{op} - {desc}" if include_op else desc

    return value


def get_notification_attachment_body(op: str | None, desc: str | None) -> str:
    """Get the 'span evidence' data for a performance problem. This is displayed in issue alert emails."""
    value = "no value"
    if not op and desc:
        value = desc
    if op and not desc:
        value = op
    if op and desc:
        value = f"{op} - {desc}"
    return value


def does_overlap_previous_span(previous_span: Span, current_span: Span) -> bool:
    previous_span_ends = timedelta(seconds=previous_span.get("timestamp", 0))
    current_span_begins = timedelta(seconds=current_span.get("start_timestamp", 0))
    return previous_span_ends > current_span_begins


def get_span_duration(span: Span) -> timedelta:
    return timedelta(seconds=span.get("timestamp", 0)) - timedelta(
        seconds=span.get("start_timestamp", 0)
    )


def get_duration_between_spans(first_span: Span, second_span: Span) -> float:
    first_span_ends = first_span.get("timestamp", 0)
    second_span_begins = second_span.get("start_timestamp", 0)
    return timedelta(seconds=second_span_begins - first_span_ends).total_seconds() * 1000


def get_url_from_span(span: Span) -> str:
    """
    Parses the span data and pulls out the URL. Accounts for different SDKs and
    different versions of SDKs formatting and parsing the URL contents
    differently.
    """

    data = span.get("data") or {}

    # The most modern version is to provide URL information in the span
    # data
    url_data = data.get("url")

    if type(url_data) is dict:
        # Some transactions mysteriously provide the URL as a dict that looks
        # like JavaScript's URL object
        url = url_data.get("pathname") or ""
        url += url_data.get("search") or ""
        return url

    if type(url_data) is str:
        # Usually the URL is a regular string, and so is the query. This
        # is the standardized format for all SDKs, and is the preferred
        # format going forward. Otherwise, if `http.query` is absent, `url`
        # contains the query.
        url = url_data
        query_data = data.get("http.query")
        if type(query_data) is str and len(query_data) > 0:
            # Only append the query string if the URL doesn't already contain one
            if "?" not in url:
                url += f"?{query_data}"
        return url

    # Attempt to parse the full URL from the span description, in case
    # the previous approaches did not yield a good result
    description = span.get("description") or ""
    parts = description.split(" ", 1)
    if len(parts) == 2:
        url = parts[1]
        return url

    return ""


def fingerprint_spans(spans: list[Span], unique_only: bool = False) -> str:
    span_hashes = []
    for span in spans:
        hash = str(span.get("hash", "") or "")
        if not unique_only or hash not in span_hashes:
            span_hashes.append(hash)
    joined_hashes = "-".join(span_hashes)
    return hashlib.sha1(joined_hashes.encode("utf8")).hexdigest()


# Creates a stable fingerprint given the same span details using sha1.
def fingerprint_span(span: Span) -> str | None:
    op = span.get("op", None)
    description = span.get("description", None)
    if not description or not op:
        return None

    signature = (str(op) + str(description)).encode("utf-8")
    full_fingerprint = hashlib.sha1(signature).hexdigest()
    fingerprint = full_fingerprint[
        :20
    ]  # 80 bits. Not a cryptographic usage, we don't need all of the sha1 for collision detection

    return fingerprint


def total_span_time(span_list: list[Span]) -> float:
    """Return the total non-overlapping span time in milliseconds for all the spans in the list"""
    # Sort the spans so that when iterating the next span in the list is either within the current, or afterwards
    sorted_span_list = sorted(span_list, key=lambda span: span["start_timestamp"])
    total_duration = 0.0
    first_item = sorted_span_list[0]
    current_min = first_item["start_timestamp"]
    current_max = first_item["timestamp"]
    for span in sorted_span_list[1:]:
        # If the start is contained within the current, check if the max extends the current duration
        if current_min <= span["start_timestamp"] <= current_max:
            current_max = max(span["timestamp"], current_max)
        # If not within current min&max then there's a gap between spans, so add to total_duration and start a new
        # min/max
        else:
            total_duration += current_max - current_min
            current_min = span["start_timestamp"]
            current_max = span["timestamp"]
    # Add the remaining duration
    total_duration += current_max - current_min
    return total_duration * 1000


def log_invalid_span_data(
    span: Span,
    detector: str,
    key: str,
    value: Any,
    error: Exception | None = None,
    extra_data: dict[str, Any] | None = None,
) -> None:
    """
    Track instances of detectors encountering data they're not expecting, so we can consider
    updating them to handle it.

    Logs an `issue_detectors.invalid_data` warning tagged with:
        - span, trace, project, and org ids,
        - the detector name,
        - the bad value,
        - the error the bad data would have caused (optional), and
        - any other data passed in the `extra_data` parameter (also optional).
    """
    logger.warning(
        "issue_detectors.invalid_data",
        extra={
            "detector": detector,
            "span_id": span.get("span_id"),
            "trace_id": span.get("trace_id"),
            "project_id": span.get("project_id"),
            "org_id": span.get("organization_id"),
            "key": key,
            "value": value,
            "error": repr(error),  # We use `repr` over `str` to also get error type
            **(extra_data or {}),
        },
    )


def _presumably_safe_ensure_numeric_type[T: (int, float)](
    value: Any, desired_type: type[T]
) -> tuple[bool, T | None, str | None]:
    """
    Attempt to coerce `value` to be either an int or float. Returns a tuple of the form `(True,
    new_value, None)` if conversion is successful, and `(False, None, failure_reason)` if it's not,
    where `failure_reason` is a string describing the kind of invalid value found.

    Rejects bools, `NaN`, and `inf` because they don't represent usable numbers, even if they
    technically would pass a typecheck. Also rejects non-integral floats and oversize ints, because
    conversion would be lossy or raise errors, respectively.

    Note: This theoretically covers all of the ways a value can be invalid, and therefore shouldn't
    ever error out. That said, it purposefully doesn't wrap the final conversion in a try-except, so
    that if a new way to be wrong ever does show up, it'll be noisier than just a warning log and
    we'll know to come and fix this helper. Thus "presumably safe" rather than "safe."
    """
    # Strings are the one non-number type we might be able to use. If we find one, first try
    # converting it into a number before doing the other checks/the final conversion. We use `float`
    # here because it will accept both stringified floats and stringified ints, whereas `int` only
    # accepts the latter.
    if isinstance(value, str):
        try:
            value = float(value)
        except Exception:
            return (False, None, "non_number_string")

    # Not a number at all
    if not isinstance(value, (int, float)):
        return (False, None, type(value).__name__)

    # Technically a number, typecheck-wise, but not a true numerical value
    if isinstance(value, bool):
        return (False, None, "bool")
    if isinstance(value, float) and not math.isfinite(value):
        return (False, None, "non_number_float")

    # A real numerical value, but not one we can convert to the type we want
    if desired_type is int and not value.is_integer():
        return (False, None, "non_integer_float")
    if desired_type is float and abs(value) > sys.float_info.max:
        return (False, None, "oversize_int")

    # If we get here, we've got a value which is both valid and convertible. To save ourselves a
    # bunch more typechecking, we unconditionally apply the conversion function, even though it'll
    # end up just being a pass-through for values which are already the right type.
    return (True, desired_type(value), None)


def get_numeric_value_from_span[T: (int, float)](
    span: Span,
    keys: list[str],  # A list of keys under which to look for the data
    detector: str,  # Detector identifier to use in invalid data logs
    number_type: type[T],  # `int` or `float`, used for converting string values
    default: T | None = None,  # Optional default value to return instead of None
) -> T | None:
    """
    Pull a numeric value from a span's `data` attribute, attempting to convert it to the desired
    type if necessary. Tracks invalid values using the `log_invalid_span_data` util. Returns `None`
    (or the optional default, if given) for missing or invalid values.
    """
    if not keys:  # Failsafe - shouldn't happen
        return default

    data = span.get("data")
    if not data:
        return default

    # Some data might exist under multiple potential keys
    for key in keys:
        value = data.get(key)
        if value is not None:
            break

    if value is None:
        return default

    # Check value type and attempt to convert if necessary
    success, result, bad_value_type = _presumably_safe_ensure_numeric_type(value, number_type)

    if success:
        return result
    else:
        log_invalid_span_data(
            span,
            detector=detector,
            key=key,
            value=value,
            error=ValueError(
                f"Couldn't convert <{bad_value_type}> to <{number_type.__name__}>. Invalid value: {value}"
            ),
        )
        return default

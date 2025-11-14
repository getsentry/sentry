import hashlib
import re
from datetime import timedelta
from typing import int, TypedDict
from urllib.parse import parse_qs, urlparse

from ..types import Span

FILTERED_KEYWORDS = [
    "[Filtered]",
    "[ip]",
    "[REDACTED]",
    "[id]",
    "[Filtered Email]",
    "[filtered]",
    "[Filtered email]",
    "[Email]",
]

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


def is_filtered_url(url: str) -> bool:
    return any(keyword in url for keyword in FILTERED_KEYWORDS)


# Creates a stable fingerprint for resource spans from their description (url), removing common cache busting tokens.
def fingerprint_resource_span(span: Span) -> str:
    url = urlparse(span.get("description") or "")
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
    parsed_url = urlparse(str(url))

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
            path_param = PARAMETERIZED_URL_REGEX.search(fragment)
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
        if url and not is_filtered_url(url):
            parametrized_url = parameterize_url(url)
            path = urlparse(parametrized_url).path
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
    op = span.get("op")
    desc = span.get("description")
    if not op and desc and isinstance(desc, str):
        value = desc
    elif not desc and op and isinstance(op, str):
        value = op
    elif op and isinstance(op, str) and desc and isinstance(desc, str):
        value = f"{op} - {desc}"
        if not include_op:
            value = desc
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

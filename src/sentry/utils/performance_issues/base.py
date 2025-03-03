from __future__ import annotations

import hashlib
import random
import re
from abc import ABC, abstractmethod
from datetime import timedelta
from enum import Enum
from typing import Any, ClassVar
from urllib.parse import parse_qs, urlparse

from sentry import options
from sentry.models.organization import Organization
from sentry.models.project import Project

from .types import PerformanceProblemsMap, Span


class DetectorType(Enum):
    SLOW_DB_QUERY = "slow_db_query"
    RENDER_BLOCKING_ASSET_SPAN = "render_blocking_assets"
    N_PLUS_ONE_DB_QUERIES = "n_plus_one_db"
    N_PLUS_ONE_DB_QUERIES_EXTENDED = "n_plus_one_db_ext"
    N_PLUS_ONE_API_CALLS = "n_plus_one_api_calls"
    CONSECUTIVE_DB_OP = "consecutive_db"
    CONSECUTIVE_HTTP_OP = "consecutive_http"
    LARGE_HTTP_PAYLOAD = "large_http_payload"
    FILE_IO_MAIN_THREAD = "file_io_main_thread"
    M_N_PLUS_ONE_DB = "m_n_plus_one_db"
    UNCOMPRESSED_ASSETS = "uncompressed_assets"
    DB_MAIN_THREAD = "db_main_thread"
    HTTP_OVERHEAD = "http_overhead"


# Detector and the corresponding system option must be added to this list to have issues created.
DETECTOR_TYPE_ISSUE_CREATION_TO_SYSTEM_OPTION = {
    DetectorType.N_PLUS_ONE_DB_QUERIES: "performance.issues.n_plus_one_db.problem-creation",
    DetectorType.N_PLUS_ONE_DB_QUERIES_EXTENDED: "performance.issues.n_plus_one_db_ext.problem-creation",
    DetectorType.CONSECUTIVE_DB_OP: "performance.issues.consecutive_db.problem-creation",
    DetectorType.CONSECUTIVE_HTTP_OP: "performance.issues.consecutive_http.flag_disabled",
    DetectorType.LARGE_HTTP_PAYLOAD: "performance.issues.large_http_payload.flag_disabled",
    DetectorType.N_PLUS_ONE_API_CALLS: "performance.issues.n_plus_one_api_calls.problem-creation",
    DetectorType.FILE_IO_MAIN_THREAD: "performance.issues.file_io_main_thread.problem-creation",
    DetectorType.UNCOMPRESSED_ASSETS: "performance.issues.compressed_assets.problem-creation",
    DetectorType.SLOW_DB_QUERY: "performance.issues.slow_db_query.problem-creation",
    DetectorType.RENDER_BLOCKING_ASSET_SPAN: "performance.issues.render_blocking_assets.problem-creation",
    DetectorType.M_N_PLUS_ONE_DB: "performance.issues.m_n_plus_one_db.problem-creation",
    DetectorType.DB_MAIN_THREAD: "performance.issues.db_main_thread.problem-creation",
    DetectorType.HTTP_OVERHEAD: "performance.issues.http_overhead.problem-creation",
}


class PerformanceDetector(ABC):
    """
    Classes of this type have their visit functions called as the event is walked once and will store a performance issue if one is detected.
    """

    type: ClassVar[DetectorType]
    stored_problems: PerformanceProblemsMap

    def __init__(self, settings: dict[DetectorType, Any], event: dict[str, Any]) -> None:
        self.settings = settings[self.settings_key]
        self._event = event

    def find_span_prefix(self, settings, span_op: str):
        allowed_span_ops = settings.get("allowed_span_ops", [])
        if len(allowed_span_ops) <= 0:
            return True
        return next((op for op in allowed_span_ops if span_op.startswith(op)), False)

    def settings_for_span(self, span: Span):
        op = span.get("op", None)
        span_id = span.get("span_id", None)
        if not op or not span_id:
            return None

        span_duration = get_span_duration(span)
        for setting in self.settings:
            op_prefix = self.find_span_prefix(setting, op)
            if op_prefix:
                return op, span_id, op_prefix, span_duration, setting
        return None

    def event(self) -> dict[str, Any]:
        return self._event

    @property
    @abstractmethod
    def settings_key(self) -> DetectorType:
        raise NotImplementedError

    @abstractmethod
    def visit_span(self, span: Span) -> None:
        raise NotImplementedError

    def on_complete(self) -> None:
        pass

    def is_creation_allowed_for_system(self) -> bool:
        system_option = DETECTOR_TYPE_ISSUE_CREATION_TO_SYSTEM_OPTION.get(self.__class__.type, None)

        if not system_option:
            return False

        try:
            creation_option_value: bool | float | None = options.get(system_option)
            if isinstance(creation_option_value, bool):
                return not creation_option_value
            elif isinstance(
                creation_option_value, float
            ):  # If the option is a float, we are controlling it with a rate. TODO - make all detectors use boolean
                return creation_option_value > random.random()
            return False

        except options.UnknownOption:
            return False

    def is_creation_allowed_for_organization(self, organization: Organization) -> bool:
        return False  # Creation is off by default. Ideally, it should auto-generate the feature flag name, and check its value

    def is_creation_allowed_for_project(self, project: Project) -> bool:
        return False  # Creation is off by default. Ideally, it should auto-generate the project option name, and check its value

    @classmethod
    def is_detector_enabled(cls) -> bool:
        return True

    @classmethod
    def is_event_eligible(cls, event, project: Project | None = None) -> bool:
        return True


def does_overlap_previous_span(previous_span: Span, current_span: Span):
    previous_span_ends = timedelta(seconds=previous_span.get("timestamp", 0))
    current_span_begins = timedelta(seconds=current_span.get("start_timestamp", 0))
    return previous_span_ends > current_span_begins


def get_span_duration(span: Span) -> timedelta:
    return timedelta(seconds=span.get("timestamp", 0)) - timedelta(
        seconds=span.get("start_timestamp", 0)
    )


def get_duration_between_spans(first_span: Span, second_span: Span):
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


def fingerprint_spans(spans: list[Span], unique_only: bool = False):
    span_hashes = []
    for span in spans:
        hash = str(span.get("hash", "") or "")
        if not unique_only or hash not in span_hashes:
            span_hashes.append(hash)
    joined_hashes = "-".join(span_hashes)
    return hashlib.sha1(joined_hashes.encode("utf8")).hexdigest()


# Creates a stable fingerprint given the same span details using sha1.
def fingerprint_span(span: Span):
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


def total_span_time(span_list: list[dict[str, Any]]) -> float:
    """Return the total non-overlapping span time in milliseconds for all the spans in the list"""
    # Sort the spans so that when iterating the next span in the list is either within the current, or afterwards
    sorted_span_list = sorted(span_list, key=lambda span: span["start_timestamp"])
    total_duration = 0
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


# Creates a stable fingerprint for resource spans from their description (url), removing common cache busting tokens.
def fingerprint_resource_span(span: Span):
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


def parameterize_url(url: str) -> str:
    parsed_url = urlparse(str(url))

    protocol_fragments = []
    if parsed_url.scheme:
        protocol_fragments.append(parsed_url.scheme)
        protocol_fragments.append("://")

    host_fragments = []
    for fragment in parsed_url.netloc.split("."):
        host_fragments.append(str(fragment))

    path_fragments = []
    for fragment in parsed_url.path.split("/"):
        if PARAMETERIZED_URL_REGEX.search(fragment):
            path_fragments.append("*")
        else:
            path_fragments.append(str(fragment))

    query = parse_qs(parsed_url.query)

    return "".join(
        [
            "".join(protocol_fragments),
            ".".join(host_fragments),
            "/".join(path_fragments),
            "?",
            "&".join(sorted([f"{key}=*" for key in query.keys()])),
        ]
    ).rstrip("?")


def fingerprint_http_spans(spans: list[Span]) -> str:
    """
    Fingerprints http spans based on their paramaterized paths, assumes all spans are http spans
    """
    url_paths = []
    for http_span in spans:
        url = get_url_from_span(http_span)
        if url:
            parametrized_url = parameterize_url(url)
            path = urlparse(parametrized_url).path
            if path not in url_paths:
                url_paths.append(path)
    url_paths.sort()

    hashed_url_paths = hashlib.sha1(("-".join(url_paths)).encode("utf8")).hexdigest()
    return hashed_url_paths


def get_span_evidence_value(
    span: dict[str, str | float] | None = None, include_op: bool = True
) -> str:
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


def get_notification_attachment_body(op, desc) -> str:
    """Get the 'span evidence' data for a performance problem. This is displayed in issue alert emails."""
    value = "no value"
    if not op and desc:
        value = desc
    if op and not desc:
        value = op
    if op and desc:
        value = f"{op} - {desc}"
    return value

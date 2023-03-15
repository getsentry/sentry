from __future__ import annotations

import hashlib
import random
import re
from abc import ABC, abstractmethod
from datetime import timedelta
from enum import Enum
from typing import Any, Dict, List
from urllib.parse import urlparse

from sentry import options
from sentry.eventstore.models import Event
from sentry.issues.grouptype import (
    PerformanceConsecutiveDBQueriesGroupType,
    PerformanceConsecutiveHTTPQueriesGroupType,
    PerformanceFileIOMainThreadGroupType,
    PerformanceMNPlusOneDBQueriesGroupType,
    PerformanceNPlusOneAPICallsGroupType,
    PerformanceNPlusOneGroupType,
    PerformanceRenderBlockingAssetSpanGroupType,
    PerformanceSlowDBQueryGroupType,
    PerformanceUncompressedAssetsGroupType,
)
from sentry.models import Organization, Project

from .types import PerformanceProblemsMap, Span


class DetectorType(Enum):
    SLOW_DB_QUERY = "slow_db_query"
    RENDER_BLOCKING_ASSET_SPAN = "render_blocking_assets"
    N_PLUS_ONE_DB_QUERIES = "n_plus_one_db"
    N_PLUS_ONE_DB_QUERIES_EXTENDED = "n_plus_one_db_ext"
    N_PLUS_ONE_API_CALLS = "n_plus_one_api_calls"
    CONSECUTIVE_DB_OP = "consecutive_db"
    CONSECUTIVE_HTTP_OP = "consecutive_http"
    FILE_IO_MAIN_THREAD = "file_io_main_thread"
    M_N_PLUS_ONE_DB = "m_n_plus_one_db"
    UNCOMPRESSED_ASSETS = "uncompressed_assets"


DETECTOR_TYPE_TO_GROUP_TYPE = {
    DetectorType.SLOW_DB_QUERY: PerformanceSlowDBQueryGroupType,
    DetectorType.RENDER_BLOCKING_ASSET_SPAN: PerformanceRenderBlockingAssetSpanGroupType,
    DetectorType.N_PLUS_ONE_DB_QUERIES: PerformanceNPlusOneGroupType,
    DetectorType.N_PLUS_ONE_DB_QUERIES_EXTENDED: PerformanceNPlusOneGroupType,
    DetectorType.N_PLUS_ONE_API_CALLS: PerformanceNPlusOneAPICallsGroupType,
    DetectorType.CONSECUTIVE_DB_OP: PerformanceConsecutiveDBQueriesGroupType,
    DetectorType.FILE_IO_MAIN_THREAD: PerformanceFileIOMainThreadGroupType,
    DetectorType.M_N_PLUS_ONE_DB: PerformanceMNPlusOneDBQueriesGroupType,
    DetectorType.UNCOMPRESSED_ASSETS: PerformanceUncompressedAssetsGroupType,
    DetectorType.CONSECUTIVE_HTTP_OP: PerformanceConsecutiveHTTPQueriesGroupType,
}


# Detector and the corresponding system option must be added to this list to have issues created.
DETECTOR_TYPE_ISSUE_CREATION_TO_SYSTEM_OPTION = {
    DetectorType.N_PLUS_ONE_DB_QUERIES: "performance.issues.n_plus_one_db.problem-creation",
    DetectorType.N_PLUS_ONE_DB_QUERIES_EXTENDED: "performance.issues.n_plus_one_db_ext.problem-creation",
    DetectorType.CONSECUTIVE_DB_OP: "performance.issues.consecutive_db.problem-creation",
    DetectorType.N_PLUS_ONE_API_CALLS: "performance.issues.n_plus_one_api_calls.problem-creation",
    DetectorType.FILE_IO_MAIN_THREAD: "performance.issues.file_io_main_thread.problem-creation",
    DetectorType.UNCOMPRESSED_ASSETS: "performance.issues.compressed_assets.problem-creation",
    DetectorType.SLOW_DB_QUERY: "performance.issues.slow_db_query.problem-creation",
    DetectorType.RENDER_BLOCKING_ASSET_SPAN: "performance.issues.render_blocking_assets.problem-creation",
    DetectorType.M_N_PLUS_ONE_DB: "performance.issues.m_n_plus_one_db.problem-creation",
}


class PerformanceDetector(ABC):
    """
    Classes of this type have their visit functions called as the event is walked once and will store a performance issue if one is detected.
    """

    type: DetectorType

    def __init__(self, settings: Dict[DetectorType, Any], event: Event):
        self.settings = settings[self.settings_key]
        self._event = event
        self.init()

    @abstractmethod
    def init(self):
        raise NotImplementedError

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

    def event(self) -> Event:
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

    @property
    @abstractmethod
    def stored_problems(self) -> PerformanceProblemsMap:
        raise NotImplementedError

    def is_creation_allowed_for_system(self) -> bool:
        system_option = DETECTOR_TYPE_ISSUE_CREATION_TO_SYSTEM_OPTION.get(self.__class__.type, None)

        if not system_option:
            return False

        try:
            rate = options.get(system_option)
        except options.UnknownOption:
            rate = 0

        return rate > random.random()

    def is_creation_allowed_for_organization(self, organization: Organization) -> bool:
        return False  # Creation is off by default. Ideally, it should auto-generate the feature flag name, and check its value

    def is_creation_allowed_for_project(self, project: Project) -> bool:
        return False  # Creation is off by default. Ideally, it should auto-generate the project option name, and check its value

    @classmethod
    def is_event_eligible(cls, event, project: Project = None) -> bool:
        return True


def get_span_duration(span: Span) -> timedelta:
    return timedelta(seconds=span.get("timestamp", 0)) - timedelta(
        seconds=span.get("start_timestamp", 0)
    )


def get_duration_between_spans(first_span: Span, second_span: Span):
    first_span_ends = first_span.get("timestamp", 0)
    second_span_begins = second_span.get("start_timestamp", 0)
    return timedelta(seconds=second_span_begins - first_span_ends).total_seconds() * 1000


def get_url_from_span(span: Span) -> str:
    data = span.get("data") or {}
    url = data.get("url") or ""
    if not url:
        # If data is missing, fall back to description
        description = span.get("description") or ""
        parts = description.split(" ", 1)
        if len(parts) == 2:
            url = parts[1]

    if type(url) is dict:
        url = url.get("pathname") or ""

    return url


def fingerprint_spans(spans: List[Span], unique_only: bool = False):
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


def total_span_time(span_list: List[Dict[str, Any]]) -> float:
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


PARAMETERIZED_SQL_QUERY_REGEX = re.compile(r"\?|\$1|%s")

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

from __future__ import annotations

import hashlib
import logging
import os
import random
import re
from abc import ABC, abstractmethod
from collections import defaultdict, deque
from datetime import timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Sequence, Tuple, cast
from urllib.parse import parse_qs, urlparse

import sentry_sdk
from symbolic import ProguardMapper  # type: ignore

from sentry import features, nodestore, options, projectoptions
from sentry.eventstore.models import Event
from sentry.models import Organization, Project, ProjectDebugFile, ProjectOption
from sentry.types.issues import GroupType
from sentry.utils import metrics
from sentry.utils.event_frames import get_sdk_name
from sentry.utils.safe import get_path

from .performance_problem import PerformanceProblem


def join_regexes(regexes: Sequence[str]) -> str:
    return r"(?:" + r")|(?:".join(regexes) + r")"


PERFORMANCE_GROUP_COUNT_LIMIT = 10
INTEGRATIONS_OF_INTEREST = [
    "django",
    "flask",
    "sqlalchemy",
    "Mongo",  # Node
    "Postgres",  # Node
]

PARAMETERIZED_SQL_QUERY_REGEX = re.compile(r"\?|\$1|%s")
CONTAINS_PARAMETER_REGEX = re.compile(
    join_regexes(
        [
            r"'(?:[^']|'')*?(?:\\'.*|'(?!'))",  # single-quoted strings
            r"\b(?:true|false)\b",  # booleans
            r"\?|\$1|%s",  # existing parameters
        ]
    )
)

URL_PARAMETER_REGEX = re.compile(
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
    (?P<sha1>
        \b[0-9a-fA-F]{40}\b
    ) |
    (?P<md5>
        \b[0-9a-fA-F]{32}\b
    ) |
    (?P<int>
        -\d+\b |
        \b\d+\b
    )
"""
)  # From message.py


class DetectorType(Enum):
    SLOW_DB_QUERY = "slow_db_query"
    RENDER_BLOCKING_ASSET_SPAN = "render_blocking_assets"
    N_PLUS_ONE_DB_QUERIES = "n_plus_one_db"
    N_PLUS_ONE_DB_QUERIES_EXTENDED = "n_plus_one_db_ext"
    N_PLUS_ONE_API_CALLS = "n_plus_one_api_calls"
    CONSECUTIVE_DB_OP = "consecutive_db"
    FILE_IO_MAIN_THREAD = "file_io_main_thread"
    M_N_PLUS_ONE_DB = "m_n_plus_one_db"
    UNCOMPRESSED_ASSETS = "uncompressed_assets"


DETECTOR_TYPE_TO_GROUP_TYPE = {
    DetectorType.SLOW_DB_QUERY: GroupType.PERFORMANCE_SLOW_DB_QUERY,
    DetectorType.RENDER_BLOCKING_ASSET_SPAN: GroupType.PERFORMANCE_RENDER_BLOCKING_ASSET_SPAN,
    DetectorType.N_PLUS_ONE_DB_QUERIES: GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
    DetectorType.N_PLUS_ONE_DB_QUERIES_EXTENDED: GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
    DetectorType.N_PLUS_ONE_API_CALLS: GroupType.PERFORMANCE_N_PLUS_ONE_API_CALLS,
    DetectorType.CONSECUTIVE_DB_OP: GroupType.PERFORMANCE_CONSECUTIVE_DB_QUERIES,
    DetectorType.FILE_IO_MAIN_THREAD: GroupType.PERFORMANCE_FILE_IO_MAIN_THREAD,
    DetectorType.M_N_PLUS_ONE_DB: GroupType.PERFORMANCE_M_N_PLUS_ONE_DB_QUERIES,
    DetectorType.UNCOMPRESSED_ASSETS: GroupType.PERFORMANCE_UNCOMPRESSED_ASSETS,
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
}


class EventPerformanceProblem:
    """
    Wrapper that binds an Event and PerformanceProblem together and allow the problem to be saved
    to and fetch from Nodestore
    """

    def __init__(self, event: Event, problem: PerformanceProblem):
        self.event = event
        self.problem = problem

    @property
    def identifier(self) -> str:
        return self.build_identifier(self.event.event_id, self.problem.fingerprint)

    @classmethod
    def build_identifier(cls, event_id: str, problem_hash: str) -> str:
        identifier = hashlib.md5(f"{problem_hash}:{event_id}".encode()).hexdigest()
        return f"p-i-e:{identifier}"

    @property
    def evidence_hashes(self):
        evidence_ids = self.problem.to_dict()
        evidence_hashes = {}

        spans_by_id = {span["span_id"]: span for span in self.event.data.get("spans", [])}

        trace = get_path(self.event.data, "contexts", "trace")
        if trace:
            spans_by_id[trace["span_id"]] = trace

        for key in ["parent", "cause", "offender"]:
            span_ids = evidence_ids.get(key + "_span_ids", []) or []
            spans = [spans_by_id.get(id) for id in span_ids]
            hashes = [span.get("hash") for span in spans if span]
            evidence_hashes[key + "_span_hashes"] = hashes

        return evidence_hashes

    def save(self):
        nodestore.set(self.identifier, self.problem.to_dict())

    @classmethod
    def fetch(cls, event: Event, problem_hash: str) -> EventPerformanceProblem:
        return cls.fetch_multi([(event, problem_hash)])[0]

    @classmethod
    def fetch_multi(
        cls, items: Sequence[Tuple[Event, str]]
    ) -> Sequence[Optional[EventPerformanceProblem]]:
        ids = [cls.build_identifier(event.event_id, problem_hash) for event, problem_hash in items]
        results = nodestore.get_multi(ids)
        return [
            cls(event, PerformanceProblem.from_dict(results[_id])) if results.get(_id) else None
            for _id, (event, _) in zip(ids, items)
        ]


Span = Dict[str, Any]
TransactionSpans = List[Span]
PerformanceProblemsMap = Dict[str, PerformanceProblem]


# Facade in front of performance detection to limit impact of detection on our events ingestion
def detect_performance_problems(data: Event, project: Project) -> List[PerformanceProblem]:
    try:
        # Add an experimental tag to be able to find these spans in production while developing. Should be removed later.
        sentry_sdk.set_tag("_did_analyze_performance_issue", "true")
        with metrics.timer(
            "performance.detect_performance_issue", sample_rate=0.01
        ), sentry_sdk.start_span(op="py.detect_performance_issue", description="none") as sdk_span:
            return _detect_performance_problems(data, sdk_span, project)
    except Exception:
        logging.exception("Failed to detect performance problems")
    return []


# Gets the thresholds to perform performance detection.
# Duration thresholds are in milliseconds.
# Allowed span ops are allowed span prefixes. (eg. 'http' would work for a span with 'http.client' as its op)
def get_detection_settings(project_id: Optional[int] = None) -> Dict[DetectorType, Any]:
    default_project_settings = (
        projectoptions.get_well_known_default(
            "sentry:performance_issue_settings",
            project=project_id,
        )
        if project_id
        else {}
    )

    project_settings = (
        ProjectOption.objects.get_value(
            project_id, "sentry:performance_issue_settings", default_project_settings
        )
        if project_id
        else {}
    )

    use_project_option_settings = default_project_settings != project_settings
    merged_project_settings = {
        **default_project_settings,
        **project_settings,
    }  # Merge saved project settings into default so updating the default to add new settings works in the future.

    # Use project settings if they've been adjusted at all, to allow customization, otherwise fetch settings from system-wide options.
    settings = (
        merged_project_settings
        if use_project_option_settings
        else {
            "n_plus_one_db_count": options.get("performance.issues.n_plus_one_db.count_threshold"),
            "n_plus_one_db_duration_threshold": options.get(
                "performance.issues.n_plus_one_db.duration_threshold"
            ),
            "render_blocking_fcp_min": options.get(
                "performance.issues.render_blocking_assets.fcp_minimum_threshold"
            ),
            "render_blocking_fcp_max": options.get(
                "performance.issues.render_blocking_assets.fcp_maximum_threshold"
            ),
            "render_blocking_fcp_ratio": options.get(
                "performance.issues.render_blocking_assets.fcp_ratio_threshold"
            ),
            "n_plus_one_api_calls_detection_rate": 1.0,
            "consecutive_db_queries_detection_rate": 1.0,
        }
    )

    return {
        DetectorType.SLOW_DB_QUERY: [
            {
                "duration_threshold": 1000.0,  # ms
                "allowed_span_ops": ["db"],
            },
        ],
        DetectorType.RENDER_BLOCKING_ASSET_SPAN: {
            "fcp_minimum_threshold": settings["render_blocking_fcp_min"],  # ms
            "fcp_maximum_threshold": settings["render_blocking_fcp_max"],  # ms
            "fcp_ratio_threshold": settings["render_blocking_fcp_ratio"],  # in the range [0, 1]
        },
        DetectorType.N_PLUS_ONE_DB_QUERIES: {
            "count": settings["n_plus_one_db_count"],
            "duration_threshold": settings["n_plus_one_db_duration_threshold"],  # ms
        },
        DetectorType.N_PLUS_ONE_DB_QUERIES_EXTENDED: {
            "count": settings["n_plus_one_db_count"],
            "duration_threshold": settings["n_plus_one_db_duration_threshold"],  # ms
        },
        DetectorType.CONSECUTIVE_DB_OP: {
            # time saved by running all queries in parallel
            "min_time_saved": 50,  # ms
            # The minimum duration of a single independent span in ms, used to prevent scenarios with a ton of small spans
            "span_duration_threshold": 30,  # ms
            "consecutive_count_threshold": 2,
            "detection_rate": settings["consecutive_db_queries_detection_rate"],
        },
        DetectorType.FILE_IO_MAIN_THREAD: [
            {
                # 16ms is when frame drops will start being evident
                "duration_threshold": 16,
            }
        ],
        DetectorType.N_PLUS_ONE_API_CALLS: {
            "detection_rate": settings["n_plus_one_api_calls_detection_rate"],
            "duration_threshold": 50,  # ms
            "concurrency_threshold": 5,  # ms
            "count": 10,
            "allowed_span_ops": ["http.client"],
        },
        DetectorType.M_N_PLUS_ONE_DB: {
            "total_duration_threshold": 100.0,  # ms
            "minimum_occurrences_of_pattern": 3,
            "max_sequence_length": 5,
        },
        DetectorType.UNCOMPRESSED_ASSETS: {
            "size_threshold_bytes": 500 * 1024,
            "duration_threshold": 500,  # ms
            "allowed_span_ops": ["resource.css", "resource.script"],
        },
    }


def _detect_performance_problems(
    data: Event, sdk_span: Any, project: Project
) -> List[PerformanceProblem]:
    event_id = data.get("event_id", None)
    project_id = cast(int, project.id)

    detection_settings = get_detection_settings(project_id)
    detectors: List[PerformanceDetector] = [
        ConsecutiveDBSpanDetector(detection_settings, data),
        SlowDBQueryDetector(detection_settings, data),
        RenderBlockingAssetSpanDetector(detection_settings, data),
        NPlusOneDBSpanDetector(detection_settings, data),
        NPlusOneDBSpanDetectorExtended(detection_settings, data),
        FileIOMainThreadDetector(detection_settings, data),
        NPlusOneAPICallsDetector(detection_settings, data),
        MNPlusOneDBSpanDetector(detection_settings, data),
        UncompressedAssetSpanDetector(detection_settings, data),
    ]

    for detector in detectors:
        run_detector_on_data(detector, data)

    # Metrics reporting only for detection, not created issues.
    report_metrics_for_detectors(data, event_id, detectors, sdk_span)

    organization = cast(Organization, project.organization)
    if project is None or organization is None:
        return []

    problems: List[PerformanceProblem] = []
    for detector in detectors:
        if all(
            [
                detector.is_creation_allowed_for_system(),
                detector.is_creation_allowed_for_organization(organization),
                detector.is_creation_allowed_for_project(project),
            ]
        ):
            problems.extend(detector.stored_problems.values())
        else:
            continue

    truncated_problems = problems[:PERFORMANCE_GROUP_COUNT_LIMIT]

    metrics.incr("performance.performance_issue.pretruncated", len(problems))
    metrics.incr("performance.performance_issue.truncated", len(truncated_problems))

    # Leans on Set to remove duplicate problems when extending a detector, since the new extended detector can overlap in terms of created issues.
    unique_problems = set(truncated_problems)

    if len(unique_problems) > 0:
        metrics.incr(
            "performance.performance_issue.performance_problem_emitted",
            len(unique_problems),
            sample_rate=1.0,
        )

    # TODO: Make sure upstream is all compatible with set before switching output type.
    return list(unique_problems)


def run_detector_on_data(detector, data):
    if not detector.is_event_eligible(data):
        return

    spans = data.get("spans", [])
    for span in spans:
        detector.visit_span(span)

    detector.on_complete()


def fingerprint_group(transaction_name, span_op, hash, problem_class):
    signature = (str(transaction_name) + str(span_op) + str(hash)).encode("utf-8")
    full_fingerprint = hashlib.sha1(signature).hexdigest()
    return f"1-{problem_class}-{full_fingerprint}"


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


def fingerprint_spans(spans: List[Span]):
    span_hashes = []
    for span in spans:
        hash = span.get("hash", "") or ""
        span_hashes.append(str(hash))
    joined_hashes = "-".join(span_hashes)
    return hashlib.sha1(joined_hashes.encode("utf8")).hexdigest()


# Simple fingerprint for broader checks, using the span op.
def fingerprint_span_op(span: Span):
    op = span.get("op", None)
    if not op:
        return None
    return op


def get_span_duration(span: Span) -> timedelta:
    return timedelta(seconds=span.get("timestamp", 0)) - timedelta(
        seconds=span.get("start_timestamp", 0)
    )


def contains_complete_query(span: Span, is_source: Optional[bool] = False) -> bool:
    # Remove the truncation check from the n_plus_one db detector.
    query = span.get("description", None)
    if is_source and query:
        return True
    else:
        return query and not query.endswith("...")


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
    def is_event_eligible(cls, event):
        return True


class SlowDBQueryDetector(PerformanceDetector):
    """
    Check for slow spans in a certain type of span.op (eg. slow db spans)
    """

    __slots__ = "stored_problems"

    type: DetectorType = DetectorType.SLOW_DB_QUERY
    settings_key = DetectorType.SLOW_DB_QUERY

    def init(self):
        self.stored_problems = {}

    def visit_span(self, span: Span):
        settings_for_span = self.settings_for_span(span)
        if not settings_for_span:
            return
        op, span_id, op_prefix, span_duration, settings = settings_for_span
        duration_threshold = settings.get("duration_threshold")

        fingerprint = fingerprint_span(span)

        if not fingerprint:
            return

        if not SlowDBQueryDetector.is_span_eligible(span):
            return

        description = span.get("description", None)
        description = description.strip()

        if span_duration >= timedelta(
            milliseconds=duration_threshold
        ) and not self.stored_problems.get(fingerprint, False):
            spans_involved = [span_id]

            hash = span.get("hash", "")
            type = DETECTOR_TYPE_TO_GROUP_TYPE[self.settings_key]

            self.stored_problems[fingerprint] = PerformanceProblem(
                type=type,
                fingerprint=self._fingerprint(hash),
                op=op,
                desc=description,
                cause_span_ids=[],
                parent_span_ids=[],
                offender_span_ids=spans_involved,
            )

    def is_creation_allowed_for_organization(self, organization: Optional[Organization]) -> bool:
        return features.has("organizations:performance-slow-db-issue", organization, actor=None)

    def is_creation_allowed_for_project(self, project: Optional[Project]) -> bool:
        return True

    @classmethod
    def is_span_eligible(cls, span: Span) -> bool:
        description = span.get("description", None)
        if not description:
            return False

        description = description.strip()
        if description[:6].upper() != "SELECT":
            return False

        if description.endswith("..."):
            return False

        return True

    def _fingerprint(self, hash):
        signature = (str(hash)).encode("utf-8")
        full_fingerprint = hashlib.sha1(signature).hexdigest()
        return f"1-{GroupType.PERFORMANCE_SLOW_DB_QUERY.value}-{full_fingerprint}"


class RenderBlockingAssetSpanDetector(PerformanceDetector):
    __slots__ = ("stored_problems", "fcp", "transaction_start")

    type: DetectorType = DetectorType.RENDER_BLOCKING_ASSET_SPAN
    settings_key = DetectorType.RENDER_BLOCKING_ASSET_SPAN

    def init(self):
        self.stored_problems = {}
        self.transaction_start = timedelta(seconds=self.event().get("start_timestamp", 0))
        self.fcp = None

        # Only concern ourselves with transactions where the FCP is within the
        # range we care about.
        measurements = self.event().get("measurements") or {}
        fcp_hash = measurements.get("fcp") or {}
        fcp_value = fcp_hash.get("value")
        if fcp_value and ("unit" not in fcp_hash or fcp_hash["unit"] == "millisecond"):
            fcp = timedelta(milliseconds=fcp_value)
            fcp_minimum_threshold = timedelta(
                milliseconds=self.settings.get("fcp_minimum_threshold")
            )
            fcp_maximum_threshold = timedelta(
                milliseconds=self.settings.get("fcp_maximum_threshold")
            )
            if fcp >= fcp_minimum_threshold and fcp < fcp_maximum_threshold:
                self.fcp = fcp

    def is_creation_allowed_for_organization(self, organization: Optional[Organization]) -> bool:
        return features.has(
            "organizations:performance-issues-render-blocking-assets-detector",
            organization,
            actor=None,
        )

    def is_creation_allowed_for_project(self, project: Project) -> bool:
        return True  # Detection always allowed by project for now

    def visit_span(self, span: Span):
        if not self.fcp:
            return

        op = span.get("op", None)
        if op not in ["resource.link", "resource.script"]:
            return False

        if self._is_blocking_render(span):
            span_id = span.get("span_id", None)
            fingerprint = self._fingerprint(span)
            if span_id and fingerprint:
                self.stored_problems[fingerprint] = PerformanceProblem(
                    fingerprint=fingerprint,
                    op=op,
                    desc=span.get("description") or "",
                    type=GroupType.PERFORMANCE_RENDER_BLOCKING_ASSET_SPAN,
                    offender_span_ids=[span_id],
                    parent_span_ids=[],
                    cause_span_ids=[],
                )

        # If we visit a span that starts after FCP, then we know we've already
        # seen all possible render-blocking resource spans.
        span_start_timestamp = timedelta(seconds=span.get("start_timestamp", 0))
        fcp_timestamp = self.transaction_start + self.fcp
        if span_start_timestamp >= fcp_timestamp:
            # Early return for all future span visits.
            self.fcp = None

    def _is_blocking_render(self, span):
        span_end_timestamp = timedelta(seconds=span.get("timestamp", 0))
        fcp_timestamp = self.transaction_start + self.fcp
        if span_end_timestamp >= fcp_timestamp:
            return False

        span_duration = get_span_duration(span)
        fcp_ratio_threshold = self.settings.get("fcp_ratio_threshold")
        return span_duration / self.fcp > fcp_ratio_threshold

    def _fingerprint(self, span):
        hashed_spans = fingerprint_spans([span])
        return f"1-{GroupType.PERFORMANCE_RENDER_BLOCKING_ASSET_SPAN.value}-{hashed_spans}"


class NPlusOneAPICallsDetector(PerformanceDetector):
    """
    Detect parallel network calls to the same endpoint.

      [-------- transaction -----------]
         [-------- parent span -----------]
          [n0] https://service.io/resources/?id=12443
          [n1] https://service.io/resources/?id=13342
          [n2] https://service.io/resources/?id=13441
          ...
    """

    __slots__ = ["stored_problems"]
    type: DetectorType = DetectorType.N_PLUS_ONE_API_CALLS
    settings_key: DetectorType = DetectorType.N_PLUS_ONE_API_CALLS

    HOST_DENYLIST = []

    def init(self):
        # TODO: Only store the span IDs and timestamps instead of entire span objects
        self.stored_problems: PerformanceProblemsMap = {}
        self.spans: list[Span] = []

    def visit_span(self, span: Span) -> None:
        if not NPlusOneAPICallsDetector.is_span_eligible(span):
            return

        op = span.get("op", None)
        if op not in self.settings.get("allowed_span_ops", []):
            return

        duration_threshold = timedelta(milliseconds=self.settings.get("duration_threshold"))
        span_duration = get_span_duration(span)

        if span_duration < duration_threshold:
            return

        previous_span = self.spans[-1] if len(self.spans) > 0 else None

        if previous_span is None:
            self.spans.append(span)
        elif self._spans_are_concurrent(previous_span, span) and self._spans_are_similar(
            previous_span, span
        ):
            self.spans.append(span)
        else:
            self._maybe_store_problem()
            self.spans = [span]

    def is_creation_allowed_for_organization(self, organization: Organization) -> bool:
        return features.has(
            "organizations:performance-n-plus-one-api-calls-detector", organization, actor=None
        )

    def is_creation_allowed_for_project(self, project: Project) -> bool:
        return self.settings["detection_rate"] > random.random()

    @staticmethod
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
            if URL_PARAMETER_REGEX.search(fragment):
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

    @classmethod
    def is_event_eligible(cls, event):
        trace_op = event.get("contexts", {}).get("trace", {}).get("op")
        if trace_op and trace_op not in ["navigation", "pageload", "ui.load", "ui.action"]:
            return False

        return True

    @classmethod
    def is_span_eligible(cls, span: Span) -> bool:
        span_id = span.get("span_id", None)
        op = span.get("op", None)
        hash = span.get("hash", None)

        if not span_id or not op or not hash:
            return False

        description = span.get("description")
        if not description:
            return False

        if description.strip()[:3].upper() != "GET":
            return False

        # GraphQL URLs have complicated queries in them. Until we parse those
        # queries to check for what's duplicated, we can't tell what is being
        # duplicated. Ignore them for now
        if "graphql" in description:
            return False

        # Next.js infixes its data URLs with a build ID. (e.g.,
        # /_next/data/<uuid>/some-endpoint) This causes a fingerprinting
        # explosion, since every deploy would change this ID and create new
        # fingerprints. Since we're not parameterizing URLs yet, we need to
        # exclude them
        if "_next/data" in description:
            return False

        url = get_url_from_span(span)
        if not url:
            return False

        parsed_url = urlparse(str(url))

        if parsed_url.netloc in cls.HOST_DENYLIST:
            return False

        # Ignore anything that looks like an asset. Some frameworks (and apps)
        # fetch assets via XHR, which is not our concern
        _pathname, extension = os.path.splitext(parsed_url.path)
        if extension and extension in [".js", ".css", ".svg", ".png", ".mp3"]:
            return False

        return True

    def on_complete(self):
        self._maybe_store_problem()
        self.spans = []

    def _maybe_store_problem(self):
        if len(self.spans) < 1:
            return

        if len(self.spans) < self.settings["count"]:
            return

        last_span = self.spans[-1]

        fingerprint = self._fingerprint()
        self.stored_problems[fingerprint] = PerformanceProblem(
            fingerprint=fingerprint,
            op=last_span["op"],
            desc=os.path.commonprefix([span.get("description", "") or "" for span in self.spans]),
            type=DETECTOR_TYPE_TO_GROUP_TYPE[self.settings_key],
            cause_span_ids=[],
            parent_span_ids=[last_span.get("parent_span_id", None)],
            offender_span_ids=[span["span_id"] for span in self.spans],
        )

    def _fingerprint(self) -> str:
        parameterized_first_url = self.parameterize_url(get_url_from_span(self.spans[0]))

        parts = parameterized_first_url.split("?")
        if len(parts) > 1:
            [path, _query] = parts
        else:
            path = parts[0]

        fingerprint = hashlib.sha1(path.encode("utf8")).hexdigest()

        return f"1-{GroupType.PERFORMANCE_N_PLUS_ONE_API_CALLS.value}-{fingerprint}"

    def _spans_are_concurrent(self, span_a: Span, span_b: Span) -> bool:
        span_a_start: int = span_a.get("start_timestamp", 0) or 0
        span_b_start: int = span_b.get("start_timestamp", 0) or 0

        return timedelta(seconds=abs(span_a_start - span_b_start)) < timedelta(
            milliseconds=self.settings["concurrency_threshold"]
        )

    def _spans_are_similar(self, span_a: Span, span_b: Span) -> bool:
        return (
            span_a["hash"] == span_b["hash"]
            and span_a["parent_span_id"] == span_b["parent_span_id"]
        )


class ConsecutiveDBSpanDetector(PerformanceDetector):
    """
    Let X and Y be the consecutive db span count threshold and the span duration threshold respectively,
    each defined in the threshold settings.

    The detector first looks for X number of consecutive db query spans,
    Once these set of spans are found, the detector will compare each db span in the consecutive list
    to determine if they are dependant on one another.
    If the sum of the durations of the independent spans exceeds Y, then a performance issue is found.

    This detector assuming spans are ordered chronologically
    """

    __slots__ = "stored_problems"

    type: DetectorType = DetectorType.CONSECUTIVE_DB_OP
    settings_key = DetectorType.CONSECUTIVE_DB_OP

    def init(self):
        self.stored_problems: dict[str, PerformanceProblem] = {}
        self.consecutive_db_spans: list[Span] = []
        self.independent_db_spans: list[Span] = []

    def visit_span(self, span: Span) -> None:
        span_id = span.get("span_id", None)

        if not span_id or not self._is_db_query(span) or self._overlaps_last_span(span):
            self._validate_and_store_performance_problem()
            self._reset_variables()
            return

        self._add_problem_span(span)

    def _add_problem_span(self, span: Span) -> None:
        self.consecutive_db_spans.append(span)

    def _validate_and_store_performance_problem(self):
        self._set_independent_spans(self.consecutive_db_spans)
        if not len(self.independent_db_spans):
            return

        exceeds_count_threshold = len(self.consecutive_db_spans) >= self.settings.get(
            "consecutive_count_threshold"
        )
        exceeds_span_duration_threshold = all(
            get_span_duration(span).total_seconds() * 1000
            > self.settings.get("span_duration_threshold")
            for span in self.independent_db_spans
        )

        exceeds_time_saved_threshold = self._calculate_time_saved(
            self.independent_db_spans
        ) > self.settings.get("min_time_saved")

        if (
            exceeds_count_threshold
            and exceeds_span_duration_threshold
            and exceeds_time_saved_threshold
        ):
            self._store_performance_problem()

    def _store_performance_problem(self) -> None:
        fingerprint = self._fingerprint()
        offender_span_ids = [span.get("span_id", None) for span in self.independent_db_spans]
        cause_span_ids = [span.get("span_id", None) for span in self.consecutive_db_spans]
        query: str = self.independent_db_spans[0].get("description", None)

        self.stored_problems[fingerprint] = PerformanceProblem(
            fingerprint,
            "db",
            desc=query,  # TODO - figure out which query to use for description
            type=GroupType.PERFORMANCE_CONSECUTIVE_DB_QUERIES,
            cause_span_ids=cause_span_ids,
            parent_span_ids=None,
            offender_span_ids=offender_span_ids,
        )

        self._reset_variables()

    def _sum_span_duration(self, spans: list[Span]) -> int:
        "Given a list of spans, find the sum of the span durations in milliseconds"
        sum = 0
        for span in spans:
            sum += get_span_duration(span).total_seconds() * 1000
        return sum

    def _set_independent_spans(self, spans: list[Span]):
        """
        Given a list of spans, checks if there is at least a single span that is independent of the rest.
        To start, we are just checking for a span in a list of consecutive span without a WHERE clause
        """
        independent_spans = []
        for span in spans[1:]:
            query: str = span.get("description", None)
            if (
                query
                and contains_complete_query(span)
                and "WHERE" not in query.upper()
                and not CONTAINS_PARAMETER_REGEX.search(query)
            ):
                independent_spans.append(span)
        self.independent_db_spans = independent_spans

    def _calculate_time_saved(self, independent_spans: list[Span]) -> float:
        """
        Calculates the cost saved by running spans in parallel,
        this is the maximum time saved of running all independent queries in parallel
        note, maximum means it does not account for db connection times and overhead associated with parallelization,
        this is where thresholds come in
        """
        consecutive_spans = self.consecutive_db_spans
        total_duration = self._sum_span_duration(consecutive_spans)

        max_independent_span_duration = max(
            [get_span_duration(span).total_seconds() * 1000 for span in independent_spans]
        )

        sum_of_dependent_span_durations = 0
        for span in consecutive_spans:
            if span not in independent_spans:
                sum_of_dependent_span_durations += get_span_duration(span).total_seconds() * 1000

        return total_duration - max(max_independent_span_duration, sum_of_dependent_span_durations)

    def _overlaps_last_span(self, span: Span) -> bool:
        if len(self.consecutive_db_spans) == 0:
            return False

        last_span = self.consecutive_db_spans[-1]

        last_span_ends = timedelta(seconds=last_span.get("timestamp", 0))
        current_span_begins = timedelta(seconds=span.get("start_timestamp", 0))
        return last_span_ends > current_span_begins

    def _reset_variables(self) -> None:
        self.consecutive_db_spans = []
        self.independent_db_spans = []

    def _is_db_query(self, span: Span) -> bool:
        op: str = span.get("op", "") or ""
        description: str = span.get("description", "") or ""
        is_db_op = op == "db" or op.startswith("db.sql")
        is_query = "SELECT" in description.upper()  # TODO - make this more elegant
        return is_db_op and is_query

    def _fingerprint(self) -> str:
        prior_span_index = self.consecutive_db_spans.index(self.independent_db_spans[0]) - 1
        hashed_spans = fingerprint_spans(
            [self.consecutive_db_spans[prior_span_index]] + self.independent_db_spans
        )
        return f"1-{GroupType.PERFORMANCE_CONSECUTIVE_DB_QUERIES.value}-{hashed_spans}"

    def on_complete(self) -> None:
        self._validate_and_store_performance_problem()

    def is_creation_allowed_for_organization(self, organization: Organization) -> bool:
        return features.has(
            "organizations:performance-consecutive-db-issue", organization, actor=None
        )

    def is_creation_allowed_for_project(self, project: Project) -> bool:
        return self.settings["detection_rate"] > random.random()

    def is_event_eligible(cls, event):
        sdk_name = get_sdk_name(event) or ""
        return "php" not in sdk_name.lower()


class NPlusOneDBSpanDetector(PerformanceDetector):
    """
    Detector goals:
      - identify a database N+1 query with high accuracy
      - collect enough information to create a good fingerprint (see below)
      - only return issues with good fingerprints

    A good fingerprint is one that gives us confidence that, if two fingerprints
    match, then they correspond to the same issue location in code (and
    therefore, the same fix).

    To do this we look for a specific structure:

      [-------- transaction span -----------]
         [-------- parent span -----------]
            [source query]
                          [n0]
                              [n1]
                                  [n2]
                                      ...

    If we detect two different N+1 problems, and both have matching parents,
    source queries, and repeated (n) queries, then we can be fairly confident
    they are the same issue.
    """

    __slots__ = (
        "stored_problems",
        "potential_parents",
        "source_span",
        "n_hash",
        "n_spans",
    )

    type: DetectorType = DetectorType.N_PLUS_ONE_DB_QUERIES
    settings_key = DetectorType.N_PLUS_ONE_DB_QUERIES

    def init(self):
        self.stored_problems = {}
        self.potential_parents = {}
        self.n_hash = None
        self.n_spans = []
        self.source_span = None
        root_span = get_path(self._event, "contexts", "trace")
        if root_span:
            self.potential_parents[root_span.get("span_id")] = root_span

    def is_creation_allowed_for_organization(self, organization: Optional[Organization]) -> bool:
        return True  # This detector is fully rolled out

    def is_creation_allowed_for_project(self, project: Optional[Project]) -> bool:
        return True  # This should probably use the `n_plus_one_db.problem-creation` option, which is currently not in use

    def visit_span(self, span: Span) -> None:
        span_id = span.get("span_id", None)
        op = span.get("op", None)
        if not span_id or not op:
            return

        if not self._is_db_op(op):
            # This breaks up the N+1 we're currently tracking.
            self._maybe_store_problem()
            self._reset_detection()
            # Treat it as a potential parent as long as it isn't the root span.
            if span.get("parent_span_id", None):
                self.potential_parents[span_id] = span
            return

        if not self.source_span:
            # We aren't currently tracking an N+1. Maybe this span triggers one!
            self._maybe_use_as_source(span)
            return

        # If we got this far, we know we're a DB span and we're looking for a
        # sequence of N identical DB spans.
        if self._continues_n_plus_1(span):
            self.n_spans.append(span)
        else:
            previous_span = self.n_spans[-1] if self.n_spans else None
            self._maybe_store_problem()
            self._reset_detection()

            # Maybe this DB span starts a whole new N+1!
            if previous_span:
                self._maybe_use_as_source(previous_span)
            if self.source_span and self._continues_n_plus_1(span):
                self.n_spans.append(span)
            else:
                self.source_span = None
                self._maybe_use_as_source(span)

    def on_complete(self) -> None:
        self._maybe_store_problem()

    def _is_db_op(self, op: str) -> bool:
        return op.startswith("db") and not op.startswith("db.redis")

    def _maybe_use_as_source(self, span: Span):
        parent_span_id = span.get("parent_span_id", None)
        if not parent_span_id or parent_span_id not in self.potential_parents:
            return

        self.source_span = span

    def _continues_n_plus_1(self, span: Span):
        if self._overlaps_last_span(span):
            return False

        expected_parent_id = self.source_span.get("parent_span_id", None)
        parent_id = span.get("parent_span_id", None)
        if not parent_id or parent_id != expected_parent_id:
            return False

        span_hash = span.get("hash", None)
        if not span_hash:
            return False

        if span_hash == self.source_span.get("hash", None):
            # The source span and n repeating spans must have different queries.
            return False

        if not self.n_hash:
            self.n_hash = span_hash
            return True

        return span_hash == self.n_hash

    def _overlaps_last_span(self, span: Span) -> bool:
        last_span = self.source_span
        if self.n_spans:
            last_span = self.n_spans[-1]

        last_span_ends = timedelta(seconds=last_span.get("timestamp", 0))
        current_span_begins = timedelta(seconds=span.get("start_timestamp", 0))
        return last_span_ends > current_span_begins

    def _maybe_store_problem(self):
        if not self.source_span or not self.n_spans:
            return

        count = self.settings.get("count")
        duration_threshold = timedelta(milliseconds=self.settings.get("duration_threshold"))

        # Do we have enough spans?
        if len(self.n_spans) < count:
            return

        # Do the spans take enough total time?
        total_duration = timedelta()
        for span in self.n_spans:
            total_duration += get_span_duration(span)
        if total_duration < duration_threshold:
            return

        # We require a parent span in order to improve our fingerprint accuracy.
        parent_span_id = self.source_span.get("parent_span_id", None)
        if not parent_span_id:
            return
        parent_span = self.potential_parents[parent_span_id]
        if not parent_span:
            return

        # Track how many N+1-looking problems we found but dropped because we
        # couldn't be sure (maybe the truncated part of the query differs).
        if not contains_complete_query(
            self.source_span, is_source=True
        ) or not contains_complete_query(self.n_spans[0]):
            metrics.incr("performance.performance_issue.truncated_np1_db")
            return

        if not self._contains_valid_repeating_query(self.n_spans[0]):
            metrics.incr("performance.performance_issue.unparametrized_first_span")
            return

        fingerprint = self._fingerprint(
            parent_span.get("op", None),
            parent_span.get("hash", None),
            self.source_span.get("hash", None),
            self.n_spans[0].get("hash", None),
        )
        if fingerprint not in self.stored_problems:
            self._metrics_for_extra_matching_spans()

            self.stored_problems[fingerprint] = PerformanceProblem(
                fingerprint=fingerprint,
                op="db",
                desc=self.n_spans[0].get("description", ""),
                type=GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
                parent_span_ids=[parent_span_id],
                cause_span_ids=[self.source_span.get("span_id", None)],
                offender_span_ids=[span.get("span_id", None) for span in self.n_spans],
            )

    def _contains_valid_repeating_query(self, span: Span) -> bool:
        query = span.get("description", None)
        return query and PARAMETERIZED_SQL_QUERY_REGEX.search(query)

    def _metrics_for_extra_matching_spans(self):
        # Checks for any extra spans that match the detected problem but are not part of affected spans.
        # Temporary check since we eventually want to capture extra perf problems on the initial pass while walking spans.
        n_count = len(self.n_spans)
        all_matching_spans = [
            span
            for span in self._event.get("spans", [])
            if span.get("span_id", None) == self.n_hash
        ]
        all_count = len(all_matching_spans)
        if n_count > 0 and n_count != all_count:
            metrics.incr("performance.performance_issue.np1_db.extra_spans")

    def _reset_detection(self):
        self.source_span = None
        self.n_hash = None
        self.n_spans = []

    def _fingerprint(self, parent_op, parent_hash, source_hash, n_hash) -> str:
        problem_class = GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES
        full_fingerprint = hashlib.sha1(
            (str(parent_op) + str(parent_hash) + str(source_hash) + str(n_hash)).encode("utf8"),
        ).hexdigest()
        return f"1-{problem_class}-{full_fingerprint}"


class NPlusOneDBSpanDetectorExtended(NPlusOneDBSpanDetector):
    """
    Detector goals:
    - Extend N+1 DB Detector to make it compatible with more frameworks.
    """

    type: DetectorType = DetectorType.N_PLUS_ONE_DB_QUERIES_EXTENDED

    __slots__ = (
        "stored_problems",
        "potential_parents",
        "source_span",
        "n_hash",
        "n_spans",
    )


class FileIOMainThreadDetector(PerformanceDetector):
    """
    Checks for a file io span on the main thread
    """

    __slots__ = ("spans_involved", "stored_problems")

    type: DetectorType = DetectorType.FILE_IO_MAIN_THREAD
    settings_key = DetectorType.FILE_IO_MAIN_THREAD

    def init(self):
        self.spans_involved = {}
        self.most_recent_start_time = {}
        self.most_recent_hash = {}
        self.stored_problems = {}
        self.mapper = None
        self.parent_to_blocked_span = defaultdict(list)
        self._prepare_deobfuscation()

    def _prepare_deobfuscation(self):
        event = self._event
        if "debug_meta" in event:
            images = event["debug_meta"].get("images", [])
            project_id = event.get("project")
            if not isinstance(images, list):
                return
            if project_id is not None:
                project = Project.objects.get_from_cache(id=project_id)
            else:
                return

            for image in images:
                if image.get("type") == "proguard":
                    uuid = image.get("uuid")
                    dif_paths = ProjectDebugFile.difcache.fetch_difs(
                        project, [uuid], features=["mapping"]
                    )
                    debug_file_path = dif_paths.get(uuid)
                    if debug_file_path is None:
                        return

                    mapper = ProguardMapper.open(debug_file_path)
                    if not mapper.has_line_info:
                        return
                    self.mapper = mapper
                    return

    def _deobfuscate_module(self, module: str) -> str:
        if self.mapper is not None:
            return self.mapper.remap_class(module)
        else:
            return module

    def _deobfuscate_function(self, frame):
        if self.mapper is not None and "module" in frame and "function" in frame:
            functions = self.mapper.remap_frame(
                frame["module"], frame["function"], frame.get("lineno") or 0
            )
            return ".".join([func.method for func in functions])
        else:
            return frame.get("function", "")

    def visit_span(self, span: Span):
        if self._is_file_io_on_main_thread(span):
            parent_span_id = span.get("parent_span_id")
            self.parent_to_blocked_span[parent_span_id].append(span)

    def on_complete(self):
        for parent_span_id, span_list in self.parent_to_blocked_span.items():
            span_list = [
                span for span in span_list if "start_timestamp" in span and "timestamp" in span
            ]
            total_duration = total_span_time(span_list)
            settings_for_span = self.settings_for_span(span_list[0])
            if not settings_for_span:
                return

            _, _, _, _, settings = settings_for_span
            if total_duration >= settings["duration_threshold"]:
                fingerprint = self._fingerprint(span_list)
                self.stored_problems[fingerprint] = PerformanceProblem(
                    fingerprint=fingerprint,
                    op=span_list[0].get("op"),
                    desc=span_list[0].get("description", ""),
                    parent_span_ids=[parent_span_id],
                    type=GroupType.PERFORMANCE_FILE_IO_MAIN_THREAD,
                    cause_span_ids=[],
                    offender_span_ids=[span["span_id"] for span in span_list if "span_id" in span],
                )

    def _fingerprint(self, span_list) -> str:
        call_stack_strings = []
        overall_stack = []
        for span in span_list:
            for item in span.get("data", {}).get("call_stack", []):
                module = self._deobfuscate_module(item.get("module", ""))
                function = self._deobfuscate_function(item)
                call_stack_strings.append(f"{module}.{function}")
            overall_stack.append(".".join(call_stack_strings))
        call_stack = "-".join(overall_stack).encode("utf8")
        hashed_stack = hashlib.sha1(call_stack).hexdigest()
        return f"1-{GroupType.PERFORMANCE_FILE_IO_MAIN_THREAD.value}-{hashed_stack}"

    def _is_file_io_on_main_thread(self, span: Span) -> bool:
        data = span.get("data", {})
        if data is None:
            return False
        # doing is True since the value can be any type
        return data.get("blocked_main_thread", False) is True

    def is_creation_allowed_for_organization(self, organization: Organization) -> bool:
        return features.has(
            "organizations:performance-file-io-main-thread-detector", organization, actor=None
        )

    def is_creation_allowed_for_project(self, project: Project) -> bool:
        return True


class MNPlusOneState(ABC):
    """Abstract base class for the MNPlusOneDBSpanDetector state machine."""

    @abstractmethod
    def next(self, span: Span) -> Tuple[MNPlusOneState, Optional[PerformanceProblem]]:
        raise NotImplementedError

    def finish(self) -> Optional[PerformanceProblem]:
        return None

    def _equivalent(self, a: Span, b: Span) -> bool:
        """db spans are equivalent if their ops and hashes match. Other spans are
        equivalent if their ops match."""
        first_op = a.get("op") or None
        second_op = b.get("op") or None
        if not first_op or not second_op or first_op != second_op:
            return False

        if first_op.startswith("db"):
            return a.get("hash") == b.get("hash")

        return True


class SearchingForMNPlusOne(MNPlusOneState):
    """
    The initial state for the MN+1 DB Query detector, and the state we return to
    whenever there is no active repeating pattern being checked.

    Keeps a list of recently seen spans until a repeat is found, at which point
    it transitions to the ContinuingMNPlusOne state.
    """

    __slots__ = ("settings", "recent_spans")

    def __init__(
        self, settings: Dict[str, Any], initial_spans: Optional[Sequence[Span]] = None
    ) -> None:
        self.settings = settings
        self.recent_spans = deque(initial_spans or [], self.settings["max_sequence_length"])

    def next(self, span: Span) -> Tuple[MNPlusOneState, Optional[PerformanceProblem]]:
        # Can't be a potential MN+1 without at least 2 previous spans.
        if len(self.recent_spans) <= 1:
            self.recent_spans.append(span)
            return (self, None)

        # Has an MN pattern begun to repeat itself? If so, transition to the
        # ContinuingMNPlusOne state.
        # Convert the recent_spans deque into a list for slicing. Skip the last
        # item in the list because that would find an N+1 instead.
        recent_span_list = list(self.recent_spans)
        for i, recent_span in enumerate(recent_span_list[:-1]):
            if self._equivalent(span, recent_span):
                pattern = recent_span_list[i:]
                if self._is_valid_pattern(pattern):
                    return (ContinuingMNPlusOne(self.settings, pattern, span), None)

        # We haven't found a pattern yet, so remember this span and keep
        # looking.
        self.recent_spans.append(span)
        return (self, None)

    def _is_valid_pattern(self, pattern: Sequence[Span]) -> bool:
        """A valid pattern contains at least one db operation and is not all equivalent."""
        found_db_op = False
        found_different_span = False

        for span in pattern:
            op = span.get("op") or ""
            description = span.get("description") or ""
            found_db_op = found_db_op or (
                op.startswith("db") and description and not description.endswith("...")
            )
            found_different_span = found_different_span or not self._equivalent(pattern[0], span)
            if found_db_op and found_different_span:
                return True

        return False


class ContinuingMNPlusOne(MNPlusOneState):
    """
    The state for when we think we might have found a pattern: a sequence of
    spans that has begun to repeat.

    When the sequence is broken (either by a mismatched span or span iteration
    finishing), returns to the SearchingMNPlusOne state, possibly returning a
    PerformanceProblem if the detected sequence met our thresholds.
    """

    __slots__ = ("settings", "pattern", "spans", "pattern_index")

    def __init__(self, settings: Dict[str, Any], pattern: Sequence[Span], first_span: Span) -> None:
        self.settings = settings
        self.pattern = pattern

        # The full list of spans involved in the MN pattern.
        self.spans: Sequence[Span] = pattern.copy()
        self.spans.append(first_span)
        self.pattern_index = 1

    def next(self, span: Span) -> MNPlusOneState:
        # If the MN pattern is continuing, carry on in this state.
        pattern_span = self.pattern[self.pattern_index]
        if self._equivalent(pattern_span, span):
            self.spans.append(span)
            self.pattern_index += 1
            if self.pattern_index >= len(self.pattern):
                self.pattern_index = 0
            return (self, None)

        # We've broken the MN pattern, so return to the Searching state. If it
        # is a significant problem, also return a PerformanceProblem.
        times_occurred = int(len(self.spans) / len(self.pattern))
        start_index = len(self.pattern) * times_occurred
        remaining_spans = self.spans[start_index:] + [span]
        return (
            SearchingForMNPlusOne(self.settings, remaining_spans),
            self._maybe_performance_problem(),
        )

    def finish(self) -> Optional[PerformanceProblem]:
        return self._maybe_performance_problem()

    def _maybe_performance_problem(self) -> Optional[PerformanceProblem]:
        times_occurred = int(len(self.spans) / len(self.pattern))
        minimum_occurrences_of_pattern = self.settings["minimum_occurrences_of_pattern"]
        if times_occurred < minimum_occurrences_of_pattern:
            return None

        offender_span_count = len(self.pattern) * times_occurred
        offender_spans = self.spans[:offender_span_count]

        total_duration_threshold = self.settings["total_duration_threshold"]
        total_duration = total_span_time(offender_spans)
        if total_duration < total_duration_threshold:
            return None

        db_span = self._first_db_span()
        return PerformanceProblem(
            fingerprint=self._fingerprint(db_span["hash"]),
            op="db",
            desc=db_span["description"],
            type=GroupType.PERFORMANCE_M_N_PLUS_ONE_DB_QUERIES,
            parent_span_ids=[],
            cause_span_ids=[],
            offender_span_ids=[span["span_id"] for span in offender_spans],
        )

    def _first_db_span(self) -> Optional[Span]:
        for span in self.spans:
            if span["op"].startswith("db"):
                return span
        return None

    def _fingerprint(self, db_hash) -> str:
        # TODO: Add more information to the hash. Since issues aren't being
        # detected yet, this doesn't matter.
        problem_class = GroupType.PERFORMANCE_M_N_PLUS_ONE_DB_QUERIES
        full_fingerprint = hashlib.sha1(db_hash.encode("utf8")).hexdigest()
        return f"1-{problem_class}-{full_fingerprint}"


class MNPlusOneDBSpanDetector(PerformanceDetector):
    """
    Detects N+1 DB query issues where the repeated query is interspersed with
    other spans (which may or may not be other queries) that all repeat together
    (hence, MN+1).

    Currently does not consider parent or source spans, and only looks for a
    repeating pattern of spans (A B C A B C etc).

    Uses a small state machine internally.
    """

    __slots__ = ("stored_problems", "state")

    type: DetectorType = DetectorType.M_N_PLUS_ONE_DB
    settings_key = DetectorType.M_N_PLUS_ONE_DB

    def init(self):
        self.stored_problems = {}
        self.state = SearchingForMNPlusOne(self.settings)

    def visit_span(self, span):
        self.state, performance_problem = self.state.next(span)
        if performance_problem:
            self.stored_problems[performance_problem.fingerprint] = performance_problem

    def on_complete(self) -> None:
        if performance_problem := self.state.finish():
            self.stored_problems[performance_problem.fingerprint] = performance_problem


class UncompressedAssetSpanDetector(PerformanceDetector):
    """
    Checks for large assets that are affecting load time.
    """

    __slots__ = ("stored_problems", "any_compression")

    settings_key = DetectorType.UNCOMPRESSED_ASSETS
    type: DetectorType = DetectorType.UNCOMPRESSED_ASSETS

    def init(self):
        self.stored_problems = {}
        self.any_compression = False

    def visit_span(self, span: Span) -> None:
        op = span.get("op", None)
        if not op:
            return

        allowed_span_ops = self.settings.get("allowed_span_ops")
        if op not in allowed_span_ops:
            return

        data = span.get("data", None)
        transfer_size = data and data.get("Transfer Size", None)
        encoded_body_size = data and data.get("Encoded Body Size", None)
        decoded_body_size = data and data.get("Decoded Body Size", None)
        if not (encoded_body_size and decoded_body_size and transfer_size):
            return

        # Ignore assets from cache, either directly (nothing transferred) or via
        # a 304 Not Modified response (transfer is smaller than asset size).
        if transfer_size <= 0 or transfer_size < encoded_body_size:
            return

        # Ignore assets that are already compressed.
        if encoded_body_size != decoded_body_size:
            # Met criteria for a compressed span somewhere in the event.
            self.any_compression = True
            return

        # Ignore assets that aren't big enough to worry about.
        size_threshold_bytes = self.settings.get("size_threshold_bytes")
        if encoded_body_size < size_threshold_bytes:
            return

        # Ignore assets under a certain duration threshold
        if get_span_duration(span).total_seconds() * 1000 <= self.settings.get(
            "duration_threshold"
        ):
            return

        fingerprint = self._fingerprint(span)
        span_id = span.get("span_id", None)
        if fingerprint and span_id and not self.stored_problems.get(fingerprint, False):
            self.stored_problems[fingerprint] = PerformanceProblem(
                fingerprint=fingerprint,
                op=span.get("op"),
                desc=span.get("description", ""),
                parent_span_ids=[],
                type=GroupType.PERFORMANCE_UNCOMPRESSED_ASSETS,
                cause_span_ids=[],
                offender_span_ids=[span.get("span_id", None)],
            )

    def _fingerprint(self, span) -> str:
        hashed_spans = fingerprint_spans([span])
        return f"1-{GroupType.PERFORMANCE_UNCOMPRESSED_ASSETS.value}-{hashed_spans}"

    def is_creation_allowed_for_organization(self, organization: Organization) -> bool:
        return features.has(
            "organizations:performance-issues-compressed-assets-detector", organization, actor=None
        )

    def is_creation_allowed_for_project(self, project: Project) -> bool:
        return True  # Detection always allowed by project for now

    def is_event_eligible(cls, event):
        tags = event.get("tags", [])
        browser_name = next(
            (tag[1] for tag in tags if tag[0] == "browser.name" and len(tag) == 2), ""
        )
        if browser_name.lower() in [
            "chrome",
            "firefox",
            "safari",
            "edge",
        ]:
            # Only use major browsers as some mobile browser may be responsible for not sending accept-content header,
            # which isn't fixable since you can't control what headers your users are sending.
            # This can be extended later.
            return True
        return False

    def on_complete(self) -> None:
        if not self.any_compression:
            # Must have a compressed asset in the event to emit this perf problem.
            self.stored_problems = {}


# Reports metrics and creates spans for detection
def report_metrics_for_detectors(
    event: Event, event_id: Optional[str], detectors: Sequence[PerformanceDetector], sdk_span: Any
):
    all_detected_problems = [i for d in detectors for i in d.stored_problems]
    has_detected_problems = bool(all_detected_problems)
    sdk_name = get_sdk_name(event)

    try:
        # Setting a tag isn't critical, the transaction doesn't exist sometimes, if it's called outside prod code (eg. load-mocks / tests)
        set_tag = sdk_span.containing_transaction.set_tag
    except AttributeError:
        set_tag = lambda *args: None

    if has_detected_problems:
        set_tag("_pi_all_issue_count", len(all_detected_problems))
        set_tag("_pi_sdk_name", sdk_name or "")
        metrics.incr(
            "performance.performance_issue.aggregate",
            len(all_detected_problems),
            tags={"sdk_name": sdk_name},
        )
        if event_id:
            set_tag("_pi_transaction", event_id)

    tags = event.get("tags", [])
    browser_name = next(
        (tag[1] for tag in tags if tag[0] == "browser.name" and len(tag) == 2), None
    )
    allowed_browser_name = "Other"
    if browser_name in [
        "Chrome",
        "Firefox",
        "Safari",
        "Electron",
        "Chrome Mobile",
        "Edge",
        "Mobile Safari",
        "Opera",
        "Opera Mobile",
        "Chrome Mobile WebView",
        "Chrome Mobile iOS",
        "Samsung Internet",
        "Firefox Mobile",
    ]:
        # Reduce cardinality in case there are custom browser name tags.
        allowed_browser_name = browser_name

    detected_tags = {"sdk_name": sdk_name}
    event_integrations = event.get("sdk", {}).get("integrations", []) or []

    for integration_name in INTEGRATIONS_OF_INTEREST:
        detected_tags["integration_" + integration_name.lower()] = (
            integration_name in event_integrations
        )

    for detector in detectors:
        detector_key = detector.type.value
        detected_problems = detector.stored_problems
        detected_problem_keys = list(detected_problems.keys())
        detected_tags[detector_key] = bool(len(detected_problem_keys))

        if not detected_problem_keys:
            continue

        if detector.type in [DetectorType.UNCOMPRESSED_ASSETS]:
            detected_tags["browser_name"] = allowed_browser_name

        first_problem = detected_problems[detected_problem_keys[0]]
        if first_problem.fingerprint:
            set_tag(f"_pi_{detector_key}_fp", first_problem.fingerprint)

        span_id = first_problem.offender_span_ids[0]

        set_tag(f"_pi_{detector_key}", span_id)

        op_tags = {}
        for problem in detected_problems.values():
            op = problem.op
            op_tags[f"op_{op}"] = True
        metrics.incr(
            f"performance.performance_issue.{detector_key}",
            len(detected_problem_keys),
            tags=op_tags,
        )

    metrics.incr(
        "performance.performance_issue.detected",
        instance=str(has_detected_problems),
        tags=detected_tags,
    )

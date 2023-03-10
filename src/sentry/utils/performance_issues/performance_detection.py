from __future__ import annotations

import hashlib
import logging
import random
from abc import ABC, abstractmethod
from collections import defaultdict, deque
from typing import Any, Dict, List, Optional, Sequence, Tuple, cast

import sentry_sdk
from symbolic import ProguardMapper  # type: ignore

from sentry import features, nodestore, options, projectoptions
from sentry.eventstore.models import Event
from sentry.issues.grouptype import (
    PerformanceFileIOMainThreadGroupType,
    PerformanceMNPlusOneDBQueriesGroupType,
    PerformanceNPlusOneGroupType,
)
from sentry.models import Organization, Project, ProjectDebugFile, ProjectOption
from sentry.projectoptions.defaults import DEFAULT_PROJECT_PERFORMANCE_DETECTION_SETTINGS
from sentry.utils import metrics
from sentry.utils.event_frames import get_sdk_name
from sentry.utils.safe import get_path

from .base import DetectorType, PerformanceDetector
from .detectors import (
    ConsecutiveDBSpanDetector,
    ConsecutiveHTTPSpanDetector,
    NPlusOneAPICallsDetector,
    NPlusOneDBSpanDetector,
    NPlusOneDBSpanDetectorExtended,
    RenderBlockingAssetSpanDetector,
    SlowDBQueryDetector,
    UncompressedAssetSpanDetector,
)
from .performance_problem import PerformanceProblem
from .types import Span

PERFORMANCE_GROUP_COUNT_LIMIT = 10
INTEGRATIONS_OF_INTEREST = [
    "django",
    "flask",
    "sqlalchemy",
    "Mongo",  # Node
    "Postgres",  # Node
]


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


# Facade in front of performance detection to limit impact of detection on our events ingestion
def detect_performance_problems(data: Event, project: Project) -> List[PerformanceProblem]:
    try:
        rate = options.get("performance.issues.all.problem-detection")
        if rate and rate > random.random():
            # Add an experimental tag to be able to find these spans in production while developing. Should be removed later.
            sentry_sdk.set_tag("_did_analyze_performance_issue", "true")
            with metrics.timer(
                "performance.detect_performance_issue", sample_rate=0.01
            ), sentry_sdk.start_span(
                op="py.detect_performance_issue", description="none"
            ) as sdk_span:
                return _detect_performance_problems(data, sdk_span, project)
    except Exception:
        logging.exception("Failed to detect performance problems")
    return []


# Gets the thresholds to perform performance detection.
# Duration thresholds are in milliseconds.
# Allowed span ops are allowed span prefixes. (eg. 'http' would work for a span with 'http.client' as its op)
def get_detection_settings(project_id: Optional[int] = None) -> Dict[DetectorType, Any]:
    system_settings = {
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
        "render_blocking_bytes_min": options.get(
            "performance.issues.render_blocking_assets.size_threshold"
        ),
    }

    default_project_settings = (
        projectoptions.get_well_known_default(
            "sentry:performance_issue_settings",
            project=project_id,
        )
        if project_id
        else {}
    )

    project_option_settings = (
        ProjectOption.objects.get_value(
            project_id, "sentry:performance_issue_settings", default_project_settings
        )
        if project_id
        else DEFAULT_PROJECT_PERFORMANCE_DETECTION_SETTINGS
    )

    project_settings = {
        **default_project_settings,
        **project_option_settings,
    }  # Merge saved project settings into default so updating the default to add new settings works in the future.

    settings = {**system_settings, **project_settings}

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
            "minimum_size_bytes": settings["render_blocking_bytes_min"],  # in bytes
        },
        DetectorType.N_PLUS_ONE_DB_QUERIES: {
            "count": settings["n_plus_one_db_count"],
            "duration_threshold": settings["n_plus_one_db_duration_threshold"],  # ms
            "detection_rate": settings["n_plus_one_db_detection_rate"],
        },
        DetectorType.N_PLUS_ONE_DB_QUERIES_EXTENDED: {
            "count": settings["n_plus_one_db_count"],
            "duration_threshold": settings["n_plus_one_db_duration_threshold"],  # ms
        },
        DetectorType.CONSECUTIVE_DB_OP: {
            # time saved by running all queries in parallel
            "min_time_saved": 100,  # ms
            # ratio between time saved and total db span durations
            "min_time_saved_ratio": 0.1,
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
            "detection_rate": settings["n_plus_one_db_detection_rate"],
        },
        DetectorType.UNCOMPRESSED_ASSETS: {
            "size_threshold_bytes": 500 * 1024,
            "duration_threshold": 500,  # ms
            "allowed_span_ops": ["resource.css", "resource.script"],
            "detection_enabled": settings["uncompressed_assets_detection_enabled"],
        },
        DetectorType.CONSECUTIVE_HTTP_OP: {
            "span_duration_threshold": 1000,  # ms
            "consecutive_count_threshold": 3,
            "max_duration_between_spans": 10000,  # ms
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
        ConsecutiveHTTPSpanDetector(detection_settings, data),
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
                    type=PerformanceFileIOMainThreadGroupType,
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
            # Use set to remove dupes, and list index to preserve order
            overall_stack.append(
                ".".join(sorted(set(call_stack_strings), key=lambda c: call_stack_strings.index(c)))
            )
        call_stack = "-".join(
            sorted(set(overall_stack), key=lambda s: overall_stack.index(s))
        ).encode("utf8")
        hashed_stack = hashlib.sha1(call_stack).hexdigest()
        return f"1-{PerformanceFileIOMainThreadGroupType.type_id}-{hashed_stack}"

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

    __slots__ = ("settings", "event", "recent_spans")

    def __init__(
        self, settings: Dict[str, Any], event: Event, initial_spans: Optional[Sequence[Span]] = None
    ) -> None:
        self.settings = settings
        self.event = event
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
                    return (ContinuingMNPlusOne(self.settings, self.event, pattern, span), None)

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
                op.startswith("db")
                and not op.startswith("db.redis")
                and description
                and not description.endswith("...")
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

    __slots__ = ("settings", "event", "pattern", "spans", "pattern_index")

    def __init__(
        self, settings: Dict[str, Any], event: Event, pattern: Sequence[Span], first_span: Span
    ) -> None:
        self.settings = settings
        self.event = event
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
            SearchingForMNPlusOne(self.settings, self.event, remaining_spans),
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

        parent_span = self._find_common_parent_span(offender_spans)
        if not parent_span:
            return None

        db_span = self._first_db_span()
        return PerformanceProblem(
            fingerprint=self._fingerprint(db_span["hash"], parent_span),
            op="db",
            desc=db_span["description"],
            type=PerformanceNPlusOneGroupType,
            parent_span_ids=[parent_span["span_id"]],
            cause_span_ids=[],
            offender_span_ids=[span["span_id"] for span in offender_spans],
        )

    def _first_db_span(self) -> Optional[Span]:
        for span in self.spans:
            if span["op"].startswith("db"):
                return span
        return None

    def _find_common_parent_span(self, spans: Sequence[Span]):
        parent_span_id = spans[0].get("parent_span_id")
        if not parent_span_id:
            return None
        for id in [span.get("parent_span_id") for span in spans[1:]]:
            if not id or id != parent_span_id:
                return None

        all_spans = self.event.get("spans") or []
        for span in all_spans:
            if span.get("span_id") == parent_span_id:
                return span
        return None

    def _fingerprint(self, db_hash: str, parent_span: Span) -> str:
        parent_op = parent_span.get("op") or ""
        parent_hash = parent_span.get("hash") or ""
        full_fingerprint = hashlib.sha1(
            (parent_op + parent_hash + db_hash).encode("utf8")
        ).hexdigest()
        return f"1-{PerformanceMNPlusOneDBQueriesGroupType.type_id}-{full_fingerprint}"


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
        self.state = SearchingForMNPlusOne(self.settings, self.event())

    def is_creation_allowed_for_organization(self, organization: Optional[Organization]) -> bool:
        return features.has(
            "organizations:performance-issues-m-n-plus-one-db-detector",
            organization,
            actor=None,
        )

    def is_creation_allowed_for_project(self, project: Project) -> bool:
        return self.settings["detection_rate"] > random.random()

    def visit_span(self, span):
        self.state, performance_problem = self.state.next(span)
        if performance_problem:
            self.stored_problems[performance_problem.fingerprint] = performance_problem

    def on_complete(self) -> None:
        if performance_problem := self.state.finish():
            self.stored_problems[performance_problem.fingerprint] = performance_problem


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

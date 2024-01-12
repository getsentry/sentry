from __future__ import annotations

import hashlib
import logging
import random
from typing import Any, Dict, List, Optional, Sequence, Tuple, Type

import sentry_sdk

from sentry import nodestore, options, projectoptions
from sentry.eventstore.models import Event
from sentry.models.options.project_option import ProjectOption
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.projectoptions.defaults import DEFAULT_PROJECT_PERFORMANCE_DETECTION_SETTINGS
from sentry.utils import metrics
from sentry.utils.event import is_event_from_browser_javascript_sdk
from sentry.utils.event_frames import get_sdk_name
from sentry.utils.safe import get_path

from .base import DetectorType, PerformanceDetector
from .detectors.consecutive_db_detector import ConsecutiveDBSpanDetector
from .detectors.consecutive_http_detector import ConsecutiveHTTPSpanDetector
from .detectors.http_overhead_detector import HTTPOverheadDetector
from .detectors.io_main_thread_detector import DBMainThreadDetector, FileIOMainThreadDetector
from .detectors.large_payload_detector import LargeHTTPPayloadDetector
from .detectors.mn_plus_one_db_span_detector import MNPlusOneDBSpanDetector
from .detectors.n_plus_one_api_calls_detector import NPlusOneAPICallsDetector
from .detectors.n_plus_one_db_span_detector import (
    NPlusOneDBSpanDetector,
    NPlusOneDBSpanDetectorExtended,
)
from .detectors.render_blocking_asset_span_detector import RenderBlockingAssetSpanDetector
from .detectors.slow_db_query_detector import SlowDBQueryDetector
from .detectors.uncompressed_asset_detector import UncompressedAssetSpanDetector
from .performance_problem import PerformanceProblem

PERFORMANCE_GROUP_COUNT_LIMIT = 10
INTEGRATIONS_OF_INTEREST = [
    "django",
    "flask",
    "sqlalchemy",
    "Mongo",  # Node
    "Postgres",  # Node
    "Mysql",  # Node
    "Prisma",  # Node
    "GraphQL",  # Node
]
SDKS_OF_INTEREST = [
    "sentry.javascript.node",
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
def detect_performance_problems(data: dict[str, Any], project: Project) -> List[PerformanceProblem]:
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


# Merges system defaults, with default project settings and saved project settings.
def get_merged_settings(project_id: Optional[int] = None) -> Dict[str | Any, Any]:
    system_settings = {
        "n_plus_one_db_count": options.get("performance.issues.n_plus_one_db.count_threshold"),
        "n_plus_one_db_duration_threshold": options.get(
            "performance.issues.n_plus_one_db.duration_threshold"
        ),
        "slow_db_query_duration_threshold": options.get(
            "performance.issues.slow_db_query.duration_threshold"
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
        "consecutive_http_spans_max_duration_between_spans": options.get(
            "performance.issues.consecutive_http.max_duration_between_spans"
        ),
        "consecutive_http_spans_count_threshold": options.get(
            "performance.issues.consecutive_http.consecutive_count_threshold"
        ),
        "consecutive_http_spans_span_duration_threshold": options.get(
            "performance.issues.consecutive_http.span_duration_threshold"
        ),
        "consecutive_http_spans_min_time_saved_threshold": options.get(
            "performance.issues.consecutive_http.min_time_saved_threshold"
        ),
        "large_http_payload_size_threshold": options.get(
            "performance.issues.large_http_payload.size_threshold"
        ),
        "db_on_main_thread_duration_threshold": options.get(
            "performance.issues.db_on_main_thread.total_spans_duration_threshold"
        ),
        "file_io_on_main_thread_duration_threshold": options.get(
            "performance.issues.file_io_on_main_thread.total_spans_duration_threshold"
        ),
        "uncompressed_asset_duration_threshold": options.get(
            "performance.issues.uncompressed_asset.duration_threshold"
        ),
        "uncompressed_asset_size_threshold": options.get(
            "performance.issues.uncompressed_asset.size_threshold"
        ),
        "consecutive_db_min_time_saved_threshold": options.get(
            "performance.issues.consecutive_db.min_time_saved_threshold"
        ),
        "http_request_delay_threshold": options.get(
            "performance.issues.http_overhead.http_request_delay_threshold"
        ),
        "n_plus_one_api_calls_total_duration_threshold": options.get(
            "performance.issues.n_plus_one_api_calls.total_duration"
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

    return {**system_settings, **project_settings}


# Gets the thresholds to perform performance detection.
# Duration thresholds are in milliseconds.
# Allowed span ops are allowed span prefixes. (eg. 'http' would work for a span with 'http.client' as its op)
def get_detection_settings(project_id: Optional[int] = None) -> Dict[DetectorType, Any]:
    settings = get_merged_settings(project_id)

    return {
        DetectorType.SLOW_DB_QUERY: [
            {
                "duration_threshold": settings["slow_db_query_duration_threshold"],  # ms
                "allowed_span_ops": ["db"],
                "detection_enabled": settings["slow_db_queries_detection_enabled"],
            },
        ],
        DetectorType.RENDER_BLOCKING_ASSET_SPAN: {
            "fcp_minimum_threshold": settings["render_blocking_fcp_min"],  # ms
            "fcp_maximum_threshold": settings["render_blocking_fcp_max"],  # ms
            "fcp_ratio_threshold": settings["render_blocking_fcp_ratio"],  # in the range [0, 1]
            "minimum_size_bytes": settings["render_blocking_bytes_min"],  # in bytes
            "detection_enabled": settings["large_render_blocking_asset_detection_enabled"],
        },
        DetectorType.N_PLUS_ONE_DB_QUERIES: {
            "count": settings["n_plus_one_db_count"],
            "duration_threshold": settings["n_plus_one_db_duration_threshold"],  # ms
            "detection_enabled": settings["n_plus_one_db_queries_detection_enabled"],
        },
        DetectorType.N_PLUS_ONE_DB_QUERIES_EXTENDED: {
            "count": settings["n_plus_one_db_count"],
            "duration_threshold": settings["n_plus_one_db_duration_threshold"],  # ms
        },
        DetectorType.CONSECUTIVE_DB_OP: {
            # time saved by running all queries in parallel
            "min_time_saved": settings["consecutive_db_min_time_saved_threshold"],  # ms
            # ratio between time saved and total db span durations
            "min_time_saved_ratio": 0.1,
            # The minimum duration of a single independent span in ms, used to prevent scenarios with a ton of small spans
            "span_duration_threshold": 30,  # ms
            "consecutive_count_threshold": 2,
            "detection_enabled": settings["consecutive_db_queries_detection_enabled"],
        },
        DetectorType.FILE_IO_MAIN_THREAD: [
            {
                # 16ms is when frame drops will start being evident
                "duration_threshold": settings["file_io_on_main_thread_duration_threshold"],
                "detection_enabled": settings["file_io_on_main_thread_detection_enabled"],
            }
        ],
        DetectorType.DB_MAIN_THREAD: [
            {
                # Basically the same as file io, but db instead, so continue using 16ms
                "duration_threshold": settings["db_on_main_thread_duration_threshold"],
                "detection_enabled": settings["db_on_main_thread_detection_enabled"],
            }
        ],
        DetectorType.N_PLUS_ONE_API_CALLS: {
            "total_duration": settings["n_plus_one_api_calls_total_duration_threshold"],  # ms
            "concurrency_threshold": 5,  # ms
            "count": 10,
            "allowed_span_ops": ["http.client"],
            "detection_enabled": settings["n_plus_one_api_calls_detection_enabled"],
        },
        DetectorType.M_N_PLUS_ONE_DB: {
            "total_duration_threshold": 100.0,  # ms
            "minimum_occurrences_of_pattern": 3,
            "max_sequence_length": 5,
            "detection_enabled": settings["n_plus_one_db_queries_detection_enabled"],
        },
        DetectorType.UNCOMPRESSED_ASSETS: {
            "size_threshold_bytes": settings["uncompressed_asset_size_threshold"],
            "duration_threshold": settings["uncompressed_asset_duration_threshold"],  # ms
            "allowed_span_ops": ["resource.css", "resource.script"],
            "detection_enabled": settings["uncompressed_assets_detection_enabled"],
        },
        DetectorType.CONSECUTIVE_HTTP_OP: {
            "span_duration_threshold": settings[
                "consecutive_http_spans_span_duration_threshold"
            ],  # ms
            "min_time_saved": settings["consecutive_http_spans_min_time_saved_threshold"],  # ms
            "consecutive_count_threshold": settings["consecutive_http_spans_count_threshold"],
            "max_duration_between_spans": settings[
                "consecutive_http_spans_max_duration_between_spans"
            ],  # ms
            "detection_enabled": settings["consecutive_http_spans_detection_enabled"],
        },
        DetectorType.LARGE_HTTP_PAYLOAD: {
            "payload_size_threshold": settings["large_http_payload_size_threshold"],
            "detection_enabled": settings["large_http_payload_detection_enabled"],
        },
        DetectorType.HTTP_OVERHEAD: {
            "http_request_delay_threshold": settings["http_request_delay_threshold"],
            "detection_enabled": settings["http_overhead_detection_enabled"],
        },
    }


DETECTOR_CLASSES: List[Type[PerformanceDetector]] = [
    ConsecutiveDBSpanDetector,
    ConsecutiveHTTPSpanDetector,
    DBMainThreadDetector,
    SlowDBQueryDetector,
    RenderBlockingAssetSpanDetector,
    NPlusOneDBSpanDetector,
    NPlusOneDBSpanDetectorExtended,
    FileIOMainThreadDetector,
    NPlusOneAPICallsDetector,
    MNPlusOneDBSpanDetector,
    UncompressedAssetSpanDetector,
    LargeHTTPPayloadDetector,
    HTTPOverheadDetector,
]


def _detect_performance_problems(
    data: dict[str, Any], sdk_span: Any, project: Project
) -> List[PerformanceProblem]:
    event_id = data.get("event_id", None)

    detection_settings = get_detection_settings(project.id)
    detectors: List[PerformanceDetector] = [
        detector_class(detection_settings, data)
        for detector_class in DETECTOR_CLASSES
        if detector_class.is_detector_enabled()
    ]

    for detector in detectors:
        run_detector_on_data(detector, data)

    # Metrics reporting only for detection, not created issues.
    report_metrics_for_detectors(data, event_id, detectors, sdk_span, project.organization)

    organization = project.organization
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


# Reports metrics and creates spans for detection
def report_metrics_for_detectors(
    event: Event,
    event_id: Optional[str],
    detectors: Sequence[PerformanceDetector],
    sdk_span: Any,
    organization: Organization,
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

    detected_tags = {
        "sdk_name": sdk_name,
        "is_early_adopter": organization.flags.early_adopter.is_set,
    }

    event_integrations = event.get("sdk", {}).get("integrations", []) or []

    for integration_name in INTEGRATIONS_OF_INTEREST:
        if integration_name in event_integrations:
            detected_tags["integration_" + integration_name.lower()] = True

    for allowed_sdk_name in SDKS_OF_INTEREST:
        if allowed_sdk_name == sdk_name:
            detected_tags["sdk_" + allowed_sdk_name.lower()] = True

    for detector in detectors:
        detector_key = detector.type.value
        detected_problems = detector.stored_problems
        detected_problem_keys = list(detected_problems.keys())
        detected_tags[detector_key] = bool(len(detected_problem_keys))

        if not detected_problem_keys:
            continue

        if detector.type in [DetectorType.UNCOMPRESSED_ASSETS]:
            detected_tags["browser_name"] = allowed_browser_name

        if detector.type in [DetectorType.CONSECUTIVE_HTTP_OP]:
            detected_tags["is_frontend"] = is_event_from_browser_javascript_sdk(event)

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

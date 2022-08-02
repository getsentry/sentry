import hashlib
import random
from abc import ABC, abstractmethod
from datetime import timedelta
from enum import Enum
from typing import Any, Dict, List

import sentry_sdk

from sentry import options
from sentry.eventstore.processing.base import Event

Span = Dict[str, Any]
TransactionSpans = List[Span]
PerformanceIssues = Dict[str, Any]


class DetectorType(Enum):
    SLOW_SPAN = "slow_span"
    DUPLICATE_SPANS = "duplicate_spans"
    SEQUENTIAL_SLOW_SPANS = "sequential_slow_spans"


# Facade in front of performance detection to limit impact of detection on our events ingestion
def detect_performance_issue(data: Event):
    try:
        rate = options.get("store.use-ingest-performance-detection-only")
        if rate and rate > random.random():
            # Add an experimental tag to be able to find these spans in production while developing. Should be removed later.
            sentry_sdk.set_tag("_did_analyze_performance_issue", "true")
            with sentry_sdk.start_span(
                op="py.detect_performance_issue", description="none"
            ) as sdk_span:
                _detect_performance_issue(data, sdk_span)
    except Exception:
        pass


# Gets some of the thresholds to perform performance detection. Can be made configurable later.
def get_detection_settings():
    return {
        DetectorType.DUPLICATE_SPANS: {
            "count": 5,
            "cumulative_duration": 500,
            "allowed_span_ops": ["db", "http"],
        },
        DetectorType.SEQUENTIAL_SLOW_SPANS: {
            "count": 3,
            "cumulative_duration": 600,
            "allowed_span_ops": ["db", "http", "ui"],
        },
        DetectorType.SLOW_SPAN: {
            "duration_threshold": 500,
            "allowed_span_ops": ["db", "http"],
        },
    }


def _detect_performance_issue(data: Event, sdk_span: Any):
    event_id = data.get("event_id", None)
    spans: TransactionSpans = data.get("spans", [])

    detection_settings = get_detection_settings()
    detectors = {
        DetectorType.DUPLICATE_SPANS: DuplicateSpanDetector(detection_settings),
        DetectorType.SLOW_SPAN: SlowSpanDetector(detection_settings),
        DetectorType.SEQUENTIAL_SLOW_SPANS: SequentialSlowSpanDetector(detection_settings),
    }

    for span in spans:
        for _, detector in detectors.items():
            detector.visit_span(span)

    all_fingerprints = [i for _, d in detectors.items() for i in d.stored_issues]

    if all_fingerprints:
        sdk_span.set_measurement("_performance_issue_count", len(all_fingerprints))
        if event_id:
            sdk_span.set_tag("_performance_issue_transaction_id", event_id)

    duplicate_performance_issues = detectors[DetectorType.DUPLICATE_SPANS].stored_issues
    duplicate_performance_fingerprints = list(duplicate_performance_issues.keys())
    if duplicate_performance_fingerprints:
        first_duplicate = duplicate_performance_issues[duplicate_performance_fingerprints[0]]
        sdk_span.set_tag("_performance_issue_duplicate_spans", first_duplicate["span_id"])

    slow_span_performance_issues = detectors[DetectorType.SLOW_SPAN].stored_issues
    slow_performance_fingerprints = list(slow_span_performance_issues.keys())
    if slow_performance_fingerprints:
        first_slow_span = slow_span_performance_issues[slow_performance_fingerprints[0]]
        sdk_span.set_tag("_performance_issue_slow_span", first_slow_span["span_id"])

    sequential_span_performance_issues = detectors[DetectorType.SEQUENTIAL_SLOW_SPANS].stored_issues
    sequential_performance_fingerprints = list(sequential_span_performance_issues.keys())
    if sequential_performance_fingerprints:
        first_sequential_span = sequential_span_performance_issues[
            sequential_performance_fingerprints[0]
        ]
        sdk_span.set_tag("_performance_issue_sequential_span", first_sequential_span["span_id"])


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


# Simple fingerprint for broader checks, using the span op.
def fingerprint_span_op(span: Span):
    op = span.get("op", None)
    if not op:
        return None
    return op


def get_span_duration(span: Span):
    return span.get("timestamp", 0) - span.get("start_timestamp", 0)


class PerformanceDetector(ABC):
    """
    Classes of this type have their visit functions called as the event is walked once and will store a performance issue if one is detected.
    """

    def __init__(self, settings: Dict[str, Any]):
        self.settings = settings[self.settings_key]
        self.init()

    @abstractmethod
    def init(self):
        raise NotImplementedError

    @property
    @abstractmethod
    def settings_key(self) -> DetectorType:
        raise NotImplementedError

    @abstractmethod
    def visit_span(self, span: Span) -> None:
        raise NotImplementedError

    @property
    @abstractmethod
    def stored_issues(self) -> PerformanceIssues:
        raise NotImplementedError


class DuplicateSpanDetector(PerformanceDetector):
    """
    Broadly check for duplicate spans.
    """

    __slots__ = ("cumulative_durations", "duplicate_spans_involved", "stored_issues")

    settings_key = DetectorType.DUPLICATE_SPANS

    def init(self):
        self.cumulative_durations = {}
        self.duplicate_spans_involved = {}
        self.stored_issues = {}

    def visit_span(self, span: Span):
        op = span.get("op", None)
        span_id = span.get("span_id", None)
        if not op or not span_id:
            return

        fingerprint = fingerprint_span(span)

        allowed_span_ops = self.settings.get("allowed_span_ops")
        duplicate_count_threshold = self.settings.get("count")
        duplicate_duration_threshold = self.settings.get("cumulative_duration")

        if not fingerprint or op not in allowed_span_ops:
            return

        span_duration = get_span_duration(span)

        self.cumulative_durations[fingerprint] = (
            self.cumulative_durations.get(fingerprint, timedelta(0)) + span_duration
        )

        if fingerprint not in self.duplicate_spans_involved:
            self.duplicate_spans_involved[fingerprint] = []

        self.duplicate_spans_involved[fingerprint] += [span_id]
        duplicate_spans_counts = len(self.duplicate_spans_involved[fingerprint])

        if not self.stored_issues.get(fingerprint, False):
            if duplicate_spans_counts >= duplicate_count_threshold and self.cumulative_durations[
                fingerprint
            ] >= timedelta(milliseconds=duplicate_duration_threshold):
                self.stored_issues[fingerprint] = {"span_id": span_id}


class SlowSpanDetector(PerformanceDetector):
    """
    Check for slow spans in a certain type of span.op (eg. slow db spans)
    """

    __slots__ = "stored_issues"

    settings_key = DetectorType.SLOW_SPAN

    def init(self):
        self.stored_issues = {}

    def visit_span(self, span: Span):
        op = span.get("op", None)
        span_id = span.get("span_id", None)
        if not op or not span_id:
            return

        fingerprint = fingerprint_span(span)

        allowed_span_ops = self.settings.get("allowed_span_ops")
        slow_span_duration_threshold = self.settings.get("duration_threshold")

        if not fingerprint or op not in allowed_span_ops:
            return

        span_duration = get_span_duration(span)

        if span_duration >= timedelta(
            milliseconds=slow_span_duration_threshold
        ) and not self.stored_issues.get(fingerprint, False):
            self.stored_issues[fingerprint] = {"span_id": span_id}


class SequentialSlowSpanDetector(PerformanceDetector):
    """
    Checks for unparallelized slower repeated spans, to suggest using futures etc. to reduce response time.
    This makes some assumptions about span ordering etc. and also removes any spans that have any overlap with the same span op from consideration.
    """

    __slots__ = ("cumulative_durations", "stored_issues", "spans_involved", "last_span_seen")

    settings_key = DetectorType.SEQUENTIAL_SLOW_SPANS

    def init(self):
        self.cumulative_durations = {}
        self.stored_issues = {}
        self.spans_involved = {}
        self.last_span_seen = {}

    def visit_span(self, span: Span):
        op = span.get("op", None)
        span_id = span.get("span_id", None)
        if not op or not span_id:
            return

        fingerprint = fingerprint_span_op(span)

        allowed_span_ops = self.settings.get("allowed_span_ops")
        count_threshold = self.settings.get("count")
        duration_threshold = self.settings.get("cumulative_duration")

        if not fingerprint or op not in allowed_span_ops:
            return

        span_duration = get_span_duration(span)
        span_end = span.get("timestamp", 0)

        if fingerprint not in self.spans_involved:
            self.spans_involved[fingerprint] = []

        self.spans_involved[fingerprint] += [span_id]

        if fingerprint not in self.last_span_seen:
            self.last_span_seen[fingerprint] = span_end
            self.cumulative_durations[fingerprint] = span_duration
            return

        last_span_end = self.last_span_seen[fingerprint]
        current_span_start = span.get("start_timestamp", 0)

        are_spans_overlapping = current_span_start <= last_span_end
        if are_spans_overlapping:
            del self.last_span_seen[fingerprint]
            self.spans_involved[fingerprint] = []
            self.cumulative_durations[fingerprint] = timedelta(0)
            return

        self.cumulative_durations[fingerprint] += span_duration
        self.last_span_seen[fingerprint] = span_end

        spans_counts = len(self.spans_involved[fingerprint])

        if not self.stored_issues.get(fingerprint, False):
            if spans_counts >= count_threshold and self.cumulative_durations[
                fingerprint
            ] >= timedelta(milliseconds=duration_threshold):
                self.stored_issues[fingerprint] = {"span_id": span_id}

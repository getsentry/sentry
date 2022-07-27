import hashlib
import random
from datetime import timedelta
from typing import Any, Dict, List

import sentry_sdk

from sentry import options
from sentry.eventstore.processing.base import Event

Span = Dict[str, Any]
TransactionSpans = List[Span]


# Facade in front of performance detection to limit impact of detection on our events ingestion
def detect_performance_issue(data: Event):
    rate = options.get("store.use-ingest-performance-detection-only")
    if rate and rate > random.random():
        _detect_performance_issue(data)


# Gets some of the thresholds to perform performance detection. Can be made configurable later.
def get_detection_settings():
    return {
        "allowed_span_ops": ["db"],  # Should move into per-detection.
        "duplicate_spans": {
            "count": 5,
            "cumulative_duration": 500,
        },
        "slow_span": {
            "duration_threshold": 500,
        },
    }


def _detect_performance_issue(data: Event):
    # Experimental tag to be able to find these spans in production while developing. Should be removed later.
    sentry_sdk.set_tag("_did_detect_performance_issue", "true")
    with sentry_sdk.start_span(op="py.detect_performance_issue", description="none") as event_span:
        spans: TransactionSpans = data.get("spans", [])

        detection_settings = get_detection_settings()
        allowed_span_ops = detection_settings.get("allowed_span_ops", [])
        duplicate_detection_settings = detection_settings.get("duplicate_spans")
        slow_span_detection_settings = detection_settings.get("slow_span")

        duplicate_count_threhsold = duplicate_detection_settings.get("count")
        duplicate_duration_threshold = duplicate_detection_settings.get("cumulative_duration")

        slow_span_duration_threshold = slow_span_detection_settings.get("duration_threshold")

        # Storing issues as we walk spans a single time
        duplicate_performance_issues = {}
        slow_span_performance_issues = {}

        # Duplicate span detection data structures
        cumulative_durations = {}
        duplicate_spans_involved = {}

        for span in spans:
            op = span.get("op", None)
            span_id = span.get("span_id", None)
            if not op or not span_id:
                continue

            if op not in allowed_span_ops:
                continue

            fingerprint = fingerprint_span(span)
            if not fingerprint:
                continue

            span_duration = span.get("timestamp", 0) - span.get("start_timestamp", 0)

            # Duplicate detection
            cumulative_durations[fingerprint] = (
                cumulative_durations.get(fingerprint, timedelta(0)) + span_duration
            )

            if fingerprint not in duplicate_spans_involved:
                duplicate_spans_involved[fingerprint] = []

            duplicate_spans_involved[fingerprint] += [span_id]
            duplicate_spans_counts = len(duplicate_spans_involved[fingerprint])

            if not duplicate_performance_issues.get(fingerprint, False):
                if duplicate_spans_counts > duplicate_count_threhsold and cumulative_durations[
                    fingerprint
                ] > timedelta(milliseconds=duplicate_duration_threshold):
                    duplicate_performance_issues[fingerprint] = {"span_id": span_id}

            # Slow span detection
            if (
                span_duration > slow_span_duration_threshold
                and not slow_span_performance_issues.get(fingerprint, False)
            ):
                slow_span_performance_issues[fingerprint] = {"span_id": span_id}

        duplicate_performance_fingerprints = list(duplicate_performance_issues.keys())
        slow_performance_fingerprints = list(slow_span_performance_issues.keys())
        if duplicate_performance_fingerprints:
            first_duplicate = duplicate_performance_issues[duplicate_performance_fingerprints[0]]
            event_span.set_tag("_performance_issue_duplicate_spans", first_duplicate["span_id"])
        if slow_performance_fingerprints:
            first_slow_span = slow_span_performance_issues[slow_performance_fingerprints[0]]
            event_span.set_tag("_performance_issue_slow_span", first_slow_span["span_id"])


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

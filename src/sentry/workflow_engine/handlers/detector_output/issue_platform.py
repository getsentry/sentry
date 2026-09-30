from __future__ import annotations

from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.utils import metrics
from sentry.workflow_engine.handlers.detector_output.base import DetectorOutcomeHandler
from sentry.workflow_engine.handlers.detector_output.registry import (
    DetectorOutcome,
    detector_outcome,
)
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.processors import DetectorEvaluation


@detector_outcome.add(DetectorOutcome.ISSUE_PLATFORM)
class IssuePlatformOutcomeHandler(DetectorOutcomeHandler):
    def handler(self, detector: Detector, evaluation: DetectorEvaluation) -> None:
        occurrence, status_change = None, None
        result = evaluation.result
        if result is None:
            return

        if isinstance(result, IssueOccurrence):
            occurrence = result
            payload_type = PayloadType.OCCURRENCE

            metrics.incr(
                "workflow_engine.issue_platform.payload.sent.occurrence",
                tags={"detector_type": detector.type},
                sample_rate=1,
            )
        else:
            status_change = result
            payload_type = PayloadType.STATUS_CHANGE
            metrics.incr(
                "workflow_engine.issue_platform.payload.sent.status_change",
                tags={"detector_type": detector.type},
                sample_rate=1,
            )

        produce_occurrence_to_kafka(
            payload_type=payload_type,
            occurrence=occurrence,
            status_change=status_change,
            event_data=evaluation.data["event_data"],
        )

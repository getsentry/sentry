from __future__ import annotations

from sentry.grouping.grouptype import ErrorGroupType
from sentry.issues.impact.evidence import build_impact_assessment_input
from sentry.issues.impact.types import (
    MAX_EVIDENCE_ITEMS,
    MAX_FRAMES,
    ProjectImpactContext,
)
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.services.eventstore.models import GroupEvent
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now


class BuildImpactAssessmentInputTest(TestCase):
    def test_builds_bounded_normalized_input(self) -> None:
        event = self.store_event(
            data={
                "culprit": "submitOrder",
                "platform": "javascript",
                "environment": "production",
                "release": "frontend@1.2.3",
                "transaction": "/checkout/submit",
                "request": {"url": "https://example.com/checkout?token=secret#payment"},
                "contexts": {
                    "react": {
                        "component_stack": [
                            *[f"Component{i}" for i in range(MAX_EVIDENCE_ITEMS)],
                            "DroppedComponent",
                        ]
                    },
                    "trace": {
                        "trace_id": "1" * 32,
                        "span_id": "2" * 16,
                        "op": "http.server",
                        "status": "internal_error",
                        "description": "POST /checkout/submit",
                    },
                },
                "exception": {
                    "values": [
                        {
                            "type": "CheckoutError",
                            "value": "Order creation failed",
                            "mechanism": {"handled": True, "type": "generic"},
                            "stacktrace": {
                                "frames": [
                                    {
                                        "function": f"function_{index}",
                                        "filename": "checkout.tsx",
                                        "in_app": True,
                                        "lineno": 100,
                                        "pre_context": ["a", "b", "c", "d"],
                                        "context_line": "await createOrder()",
                                        "post_context": ["e", "f", "g", "h"],
                                    }
                                    for index in range(MAX_FRAMES + 1)
                                ]
                            },
                        }
                    ]
                },
                "tags": {"replay_id": "volatile-replay-id"},
            },
            project_id=self.project.id,
        )

        result = build_impact_assessment_input(event)

        assert result.issue_evidence.title == "CheckoutError: Order creation failed"
        assert result.issue_evidence.url == "https://example.com/checkout"
        assert result.issue_evidence.exception is not None
        assert result.issue_evidence.exception.type == "CheckoutError"
        assert result.issue_evidence.handled is True
        assert result.issue_evidence.mechanism == "generic"
        assert len(result.issue_evidence.frames) == MAX_FRAMES
        assert result.issue_evidence.frames[0].function == "function_1"
        assert result.issue_evidence.frames[0].pre_context == ["b", "c", "d"]
        assert result.issue_evidence.frames[0].post_context == ["e", "f", "g"]
        assert len(result.issue_evidence.component_stack) == MAX_EVIDENCE_ITEMS
        assert result.issue_evidence.trace is not None
        assert result.issue_evidence.trace.status == "internal_error"
        assert result.issue_evidence.replay_available is True
        assert result.issue_evidence.evidence_ids == [
            "exception",
            "culprit",
            "transaction",
            "url",
            "platform",
            "environment",
            "release",
            "mechanism",
            "replay",
            *[f"frame-{index}" for index in range(MAX_FRAMES)],
            "component_stack",
            "trace",
        ]
        assert "1" * 32 not in result.json()
        assert "volatile-replay-id" not in result.json()
        assert len(result.fingerprint) == 64

    def test_fingerprint_changes_only_for_assessment_input(self) -> None:
        event = self.store_event(
            data={
                "platform": "python",
                "transaction": "task:generate_export",
                "exception": {
                    "values": [
                        {
                            "type": "ExportError",
                            "value": "Archive write failed",
                            "mechanism": {"handled": True},
                        }
                    ]
                },
                "user": {"id": "user-1", "email": "user@example.com"},
            },
            project_id=self.project.id,
        )
        context = ProjectImpactContext(
            description=(
                "This project runs background export jobs. Customers download the resulting "
                "archives, and failed exports can be generated again."
            )
        )

        first = build_impact_assessment_input(event, context)
        event.data["user"] = {"id": "user-2", "email": "other@example.com"}
        second = build_impact_assessment_input(event, context)
        changed_context = context.copy(
            update={"description": "This project serves interactive export downloads."}
        )
        third = build_impact_assessment_input(event, changed_context)

        assert first.fingerprint == second.fingerprint
        assert first.fingerprint != third.fingerprint
        assert first.project_context is not None
        assert "background export jobs" in first.project_context.description
        assert "user@example.com" not in first.json()

    def test_bounds_occurrence_evidence_and_excludes_reporter_identifiers(self) -> None:
        event = self.store_event(
            data={"message": "A generic issue occurred", "platform": "python"},
            project_id=self.project.id,
        )
        assert event.group is not None
        group_event = GroupEvent.from_event(event, event.group)
        group_event.occurrence = IssueOccurrence(
            id="occurrence-id",
            project_id=self.project.id,
            event_id=event.event_id,
            fingerprint=["fingerprint"],
            issue_title="Generic issue",
            subtitle="Detector evidence",
            resource_id=None,
            evidence_data={"unbounded": "data is not included"},
            evidence_display=[
                IssueEvidence("contact_email", "user@example.com", False),
                IssueEvidence("name", "Customer Name", False),
                *[
                    IssueEvidence(f"Signal {index}", f"Value {index}", index == 0)
                    for index in range(MAX_EVIDENCE_ITEMS + 1)
                ],
            ],
            type=ErrorGroupType,
            detection_time=before_now(),
            level="error",
            culprit=None,
        )

        result = build_impact_assessment_input(group_event)

        assert result.issue_evidence.title == "Generic issue"
        assert result.issue_evidence.subtitle == "Detector evidence"
        assert len(result.issue_evidence.evidence) == MAX_EVIDENCE_ITEMS
        assert result.issue_evidence.evidence[0].name == "Signal 0"
        assert "contact_email" not in result.json()
        assert "user@example.com" not in result.json()
        assert "unbounded" not in result.json()

    def test_excludes_reach_priority_and_fixability(self) -> None:
        event = self.store_event(
            data={
                "platform": "python",
                "transaction": "/auth/login/",
                "message": "Login failed",
            },
            project_id=self.project.id,
        )
        event.data.update(
            {
                "times_seen": 10_000,
                "user_count": 5_000,
                "first_seen": "2020-01-01T00:00:00Z",
                "last_seen": "2020-01-02T00:00:00Z",
                "priority": "high",
                "fixability": 0.99,
            }
        )

        serialized = build_impact_assessment_input(event).json()

        assert "times_seen" not in serialized
        assert "user_count" not in serialized
        assert "first_seen" not in serialized
        assert "last_seen" not in serialized
        assert "priority" not in serialized
        assert "fixability" not in serialized

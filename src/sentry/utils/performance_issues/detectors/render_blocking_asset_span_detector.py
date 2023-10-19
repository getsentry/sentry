from __future__ import annotations

from datetime import timedelta
from typing import Any, Mapping, Optional

from sentry import features
from sentry.issues.grouptype import PerformanceRenderBlockingAssetSpanGroupType
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.models.organization import Organization
from sentry.models.project import Project

from ..base import (
    DetectorType,
    PerformanceDetector,
    fingerprint_resource_span,
    get_notification_attachment_body,
    get_span_duration,
    get_span_evidence_value,
)
from ..performance_problem import PerformanceProblem
from ..types import Span


class RenderBlockingAssetSpanDetector(PerformanceDetector):
    __slots__ = ("stored_problems", "fcp", "transaction_start")

    type = DetectorType.RENDER_BLOCKING_ASSET_SPAN
    settings_key = DetectorType.RENDER_BLOCKING_ASSET_SPAN

    MAX_SIZE_BYTES = 1_000_000_000  # 1GB

    def init(self):
        self.stored_problems = {}
        self.transaction_start = timedelta(seconds=self.event().get("start_timestamp", 0))
        self.fcp = None
        self.fcp_value = 0

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
                self.fcp_value = fcp_value

    def is_creation_allowed_for_organization(self, organization: Optional[Organization]) -> bool:
        return features.has(
            "organizations:performance-issues-render-blocking-assets-detector",
            organization,
            actor=None,
        )

    def is_creation_allowed_for_project(self, project: Project) -> bool:
        return self.settings["detection_enabled"]

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
                    type=PerformanceRenderBlockingAssetSpanGroupType,
                    offender_span_ids=[span_id],
                    parent_span_ids=[],
                    cause_span_ids=[],
                    evidence_data={
                        "op": op,
                        "parent_span_ids": [],
                        "cause_span_ids": [],
                        "offender_span_ids": [span_id],
                        "transaction_name": self.event().get("description", ""),
                        "slow_span_description": span.get("description", ""),
                        "slow_span_duration": self._get_duration(span),
                        "transaction_duration": self._get_duration(self._event),
                        "fcp": self.fcp_value,
                        "repeating_spans": get_span_evidence_value(span),
                        "repeating_spans_compact": get_span_evidence_value(span, include_op=False),
                    },
                    evidence_display=[
                        IssueEvidence(
                            name="Offending Spans",
                            value=get_notification_attachment_body(
                                op,
                                span.get("description") or "",
                            ),
                            # Has to be marked important to be displayed in the notifications
                            important=True,
                        )
                    ],
                )

        # If we visit a span that starts after FCP, then we know we've already
        # seen all possible render-blocking resource spans.
        span_start_timestamp = timedelta(seconds=span.get("start_timestamp", 0))
        fcp_timestamp = self.transaction_start + self.fcp
        if span_start_timestamp >= fcp_timestamp:
            # Early return for all future span visits.
            self.fcp = None
            self.fcp_value = 0

    def _get_duration(self, item: Mapping[str, Any] | None) -> float:
        if not item:
            return 0

        start = float(item.get("start_timestamp", 0))
        end = float(item.get("timestamp", 0))

        return (end - start) * 1000

    def _is_blocking_render(self, span):
        data = span.get("data", None)
        render_blocking_status = data and data.get("resource.render_blocking_status")
        if render_blocking_status == "non-blocking":
            return False

        span_end_timestamp = timedelta(seconds=span.get("timestamp", 0))
        fcp_timestamp = self.transaction_start + self.fcp
        if span_end_timestamp >= fcp_timestamp:
            return False

        minimum_size_bytes = self.settings.get("minimum_size_bytes")
        # TODO(nar): `Encoded Body Size` can be removed once SDK adoption has increased and
        # we are receiving `http.response_content_length` consistently, likely beyond October 2023
        encoded_body_size = (
            data
            and (data.get("http.response_content_length", 0) or data.get("Encoded Body Size", 0))
            or 0
        )
        if encoded_body_size < minimum_size_bytes or encoded_body_size > self.MAX_SIZE_BYTES:
            return False

        span_duration = get_span_duration(span)
        fcp_ratio_threshold = self.settings.get("fcp_ratio_threshold")
        return span_duration / self.fcp > fcp_ratio_threshold

    def _fingerprint(self, span: Span):
        resource_url_hash = fingerprint_resource_span(span)
        return f"1-{PerformanceRenderBlockingAssetSpanGroupType.type_id}-{resource_url_hash}"

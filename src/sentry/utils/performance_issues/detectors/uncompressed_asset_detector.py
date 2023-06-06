from __future__ import annotations

from sentry import features
from sentry.issues.grouptype import PerformanceUncompressedAssetsGroupType
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.models import Organization, Project

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

FILE_EXTENSION_ALLOWLIST = ("css", "json", "js")


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
        description = span.get("description", "")
        if not op:
            return

        allowed_span_ops = self.settings.get("allowed_span_ops")
        if op not in allowed_span_ops:
            return

        data = span.get("data", None)
        # TODO(nar): The sentence-style keys can be removed once SDK adoption has increased and
        # we are receiving snake_case keys consistently, likely beyond October 2023
        transfer_size = data and (
            data.get("http.transfer_size", None) or data.get("Transfer Size", None)
        )
        encoded_body_size = data and (
            data.get("http.response_content_length", None) or data.get("Encoded Body Size", None)
        )
        decoded_body_size = data and (
            data.get("http.decoded_response_content_length", None)
            or data.get("Decoded Body Size", None)
        )
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

        # Ignore assets with certain file extensions
        if not description.endswith(FILE_EXTENSION_ALLOWLIST):
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
                op=op,
                desc=description,
                parent_span_ids=[],
                type=PerformanceUncompressedAssetsGroupType,
                cause_span_ids=[],
                offender_span_ids=[span.get("span_id", None)],
                evidence_data={
                    "op": op,
                    "parent_span_ids": [],
                    "cause_span_ids": [],
                    "offender_span_ids": [span.get("span_id", None)],
                    "transaction_name": self._event.get("description", ""),
                    "repeating_spans": get_span_evidence_value(span),
                    "repeating_spans_compact": get_span_evidence_value(span, include_op=False),
                    "num_repeating_spans": str(len(span.get("span_id", None))),
                },
                evidence_display=[
                    IssueEvidence(
                        name="Offending Spans",
                        value=get_notification_attachment_body(
                            op,
                            description,
                        ),
                        # Has to be marked important to be displayed in the notifications
                        important=True,
                    )
                ],
            )

    def _fingerprint(self, span) -> str:
        resource_span = fingerprint_resource_span(span)
        return f"1-{PerformanceUncompressedAssetsGroupType.type_id}-{resource_span}"

    def is_creation_allowed_for_organization(self, organization: Organization) -> bool:
        return features.has(
            "organizations:performance-issues-compressed-assets-detector", organization, actor=None
        )

    def is_creation_allowed_for_project(self, project: Project) -> bool:
        return self.settings["detection_enabled"]

    def is_event_eligible(cls, event):
        tags = event.get("tags", [])
        browser_name = next(
            (
                tag[1]
                for tag in tags
                if tag is not None and tag[0] == "browser.name" and len(tag) == 2
            ),
            "",
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

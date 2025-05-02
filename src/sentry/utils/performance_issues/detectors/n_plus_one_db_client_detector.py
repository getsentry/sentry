from __future__ import annotations

import hashlib
import pprint
from dataclasses import dataclass
from typing import Any, TypedDict

from sentry.issues.grouptype import PerformanceNPlusOneDBClientGroupType
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.utils import metrics
from sentry.utils.performance_issues.base import (
    DetectorType,
    PerformanceDetector,
    get_notification_attachment_body,
    get_span_evidence_value,
    total_span_time,
)
from sentry.utils.performance_issues.performance_problem import PerformanceProblem
from sentry.utils.performance_issues.types import Span


class NPlusOneDBClientSettings(TypedDict):
    allowed_client_span_descriptions: list[str]
    """
    A list of span descriptions which are considered to be a known DB client operation.
    """
    minimum_repetitions: int
    """
    The minimum number of repetitions which must be found to detect a problem.
    """
    minimum_total_duration_threshold: int
    """
    The minimum total duration of the N+1 client operations in milliseconds to detect a problem.
    """
    detection_enabled: bool
    """
    Whether the detector is enabled. Applied at a project level.
    """


@dataclass
class ClientOperation:
    client_span: Span
    db_predecessor_hash: str = ""
    db_span: Span | None = None
    db_successor_hash: str = ""
    is_complete: bool = False


class NPlusOneDBClientDetector(PerformanceDetector):
    """
    Detector goals:
      - Identify a database N+1 issue via a known client span with high accuracy
      - collect enough information to create a good fingerprint (see below)
      - only return issues with good fingerprints

    A good fingerprint is one that gives us confidence that, if two fingerprints
    match, then they correspond to the same issue location in code (and
    therefore, the same fix).

    To do this we look for a general structure:
        [client]
        []
          []
            [n0]
              []
                [client]
                []
                  []
                    [n1]
                      []
                        [client]
                        []
                          []
                            [n2]
                              []
        ...

    The above example shows a few spans within the client span, before the DB span. The content of
    these spans is irrelevant, but we should detect a problem if all the following are true:
        - The client span contains only one nested DB span
        - The db spans are all identical
        - The descendants of the client spans are all identical
    """

    __slots__ = ("stored_problems", "operations", "previous_operation", "current_operation")

    type = DetectorType.N_PLUS_ONE_DB_CLIENT
    settings_key = DetectorType.N_PLUS_ONE_DB_CLIENT
    settings: NPlusOneDBClientSettings

    def __init__(self, settings: dict[DetectorType, Any], event: dict[str, Any]) -> None:
        super().__init__(settings, event)
        self.stored_problems = {}
        self.operations: list[ClientOperation] = []
        """
        A sequence of operations that have been deemed equivalent.
        """
        self.previous_operation: ClientOperation | None = None
        """
        Equivalent to self.operations[-1]; used to compare against the current operation
        """
        self.current_operation: ClientOperation | None = None
        """
        The operation that is currently being processed.
        """

    def is_creation_allowed_for_organization(self, organization: Organization | None) -> bool:
        return True

    def is_creation_allowed_for_project(self, project: Project | None) -> bool:
        return self.settings["detection_enabled"]

    def on_complete(self) -> None:
        self.maybe_store_problem()

    def visit_span(self, span: Span) -> None:
        # If a span doesn't have the required fields, fingerprinting could suffer, so bail.
        if not self.has_required_fields(span):
            self.reset_detection()
            return

        # Start tracking the current operation when we hit a client span.
        if self.is_valid_db_client_span(span):
            self.start_new_operation(client_span=span)
            return

        # If we haven't found a client span yet, skip until we do.
        if self.current_operation is None:
            return

        if self.is_valid_db_span(span):
            # The client should only contain one DB span, if we find another, bail.
            if self.current_operation.db_span is not None:
                self.reset_detection()
                return
            self.current_operation.db_span = span
        # If this span is within the current operation, but not a DB span, store its hash.
        else:
            # If the current operation doesn't have a DB span, it's a predecessor...
            if self.current_operation.db_span is None:
                self.current_operation.db_predecessor_hash += span.get("hash", "")
            # Otherwise, it's a successor.
            else:
                self.current_operation.db_successor_hash += span.get("hash", "")

    def start_new_operation(self, client_span: Span) -> None:
        """
        If the current operation exists, mark it completed and store it appropriately.
        Either way, start a new operation with the given client span.
        """

        incoming_operation = ClientOperation(client_span=client_span)
        # If we don't have a current operation, store the incoming one.
        if self.current_operation is None:
            self.current_operation = incoming_operation
            return

        self.current_operation.is_complete = True

        # If there isn't a previous operation, store the current one.
        if self.previous_operation is None:
            self.previous_operation = self.current_operation
            self.operations.append(self.current_operation)

        # If the previous operation is empty, or equivalent to the current one, store the current one.
        if self.previous_operation is None or self.are_equivalent_operations(
            a=self.current_operation, b=self.previous_operation
        ):
            self.previous_operation = self.current_operation
            self.operations.append(self.current_operation)
        # Otherwise, the current operation was a whole new operation, so reset the detection.
        else:
            self.reset_detection()

        # Now that the 'current' operation has become the 'previous', use the new incoming operation
        self.current_operation = incoming_operation

    def maybe_store_problem(self) -> None:
        data = []
        for o in self.operations:
            data.append(
                {
                    "client_span": o.client_span.get("description", ""),
                    "db_span": o.db_span.get("description", ""),
                    "db_predecessor_hash": o.db_predecessor_hash,
                    "db_successor_hash": o.db_successor_hash,
                }
            )
        pprint.pprint(data)

        fingerprint = self.generate_fingerprint()
        if not fingerprint:
            metrics.incr("performance.performance_issue.np1_db_client.no_fingerprint")
            return

        client_span_list = [o.client_span for o in self.operations]

        repetitions = len(client_span_list)
        min_repetitions = self.settings.get("minimum_repetitions")
        above_minimum_repetitions = repetitions >= min_repetitions

        if above_minimum_repetitions:
            metrics.incr("performance.performance_issue.np1_db_client.above_minimum_repetitions")
            return

        min_duration = self.settings.get("minimum_total_duration_threshold")
        above_mininum_duration = total_span_time(client_span_list) < min_duration

        if above_mininum_duration:
            metrics.incr("performance.performance_issue.np1_db_client.above_mininum_duration")
            return

        if fingerprint not in self.stored_problems:
            offender_span_ids = [span.get("span_id", None) for span in client_span_list]

            self.stored_problems[fingerprint] = PerformanceProblem(
                fingerprint=fingerprint,
                op="db",
                desc=self.previous_operation.client_span.get("description", ""),
                type=PerformanceNPlusOneDBClientGroupType,
                parent_span_ids=[self.previous_operation.client_span.get("parent_span_id")],
                cause_span_ids=[self.source_span.get("span_id", None)],
                offender_span_ids=offender_span_ids,
                evidence_display=[
                    IssueEvidence(
                        name="Offending Spans",
                        value=get_notification_attachment_body(
                            "db",
                            self.n_spans[0].get("description", ""),
                        ),
                        # Has to be marked important to be displayed in the notifications
                        important=True,
                    )
                ],
                evidence_data={
                    "transaction_name": self._event.get("transaction", ""),
                    "parent_span_ids": [self.previous_operation.client_span.get("parent_span_id")],
                    "cause_span_ids": [self.previous_operation.client_span.get("parent_span_id")],
                    "offender_span_ids": offender_span_ids,
                    "repeating_spans": get_span_evidence_value(self.previous_operation.client_span),
                    "repeating_spans_compact": get_span_evidence_value(
                        self.previous_operation.client_span, include_op=False
                    ),
                    "num_repeating_spans": str(len(offender_span_ids)),
                },
            )

    def reset_detection(self) -> None:
        """
        We store any potential problems first, than reset internal state.
        """
        self.maybe_store_problem()
        self.current_operation = None
        self.previous_operation = None
        self.operations = []

    def has_required_fields(self, span: Span) -> bool:
        """
        Check whether a span has the required fields for us to process it. (span_id, hash)
        """
        has_id = span.get("span_id") is not None
        has_hash = span.get("hash") is not None
        has_parent_id = span.get("parent_span_id") is not None
        return has_hash and has_id and has_parent_id

    def is_valid_db_client_span(self, span: Span) -> bool:
        description = span.get("description", "")
        is_client_span = (
            description and description == self.settings["allowed_client_span_descriptions"]
        )
        return is_client_span

    def is_valid_db_span(self, span: Span) -> bool:
        op = span.get("op", "")
        is_db_span = op.startswith("db") and not op.startswith("db.redis")
        description = span.get("description")
        is_full_query = description and not description.endswith("...")
        return is_db_span and is_full_query

    def are_equivalent_operations(self, a: ClientOperation, b: ClientOperation) -> bool:
        """
        Compares the current item against the previous item to see if they are a match.
        """
        return (
            a.db_span.get("hash") == b.db_span.get("hash")
            and a.db_span.get("description") == b.db_span.get("description")
            and a.client_span.get("hash") == b.client_span.get("hash")
            and a.client_span.get("description") == b.client_span.get("description")
            and a.db_predecessor_hash == b.db_predecessor_hash
            and a.db_successor_hash == b.db_successor_hash
        )

    def generate_fingerprint(self) -> str | None:
        """
        Generate a fingerprint for the saved operations.
        """

        if not self.previous_operation:
            return None
        type_id = PerformanceNPlusOneDBClientGroupType.type_id
        operation_elements: list[str] = [
            str(self.previous_operation.client_span.get("hash")),
            str(self.previous_operation.db_span.get("hash")),
            str(self.previous_operation.db_predecessor_hash),
            str(self.previous_operation.db_successor_hash),
            str(self.previous_operation.client_span.get("parent_span_id")),
        ]
        operation_fingerprint = hashlib.sha1(
            "".join(operation_elements).encode("utf8"),
        ).hexdigest()

        return f"1-{type_id}-{operation_fingerprint}"

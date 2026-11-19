from collections import Counter
from datetime import datetime, timedelta
from unittest import mock
from uuid import uuid4

from sentry.anomaly_detection.contracts import (
    ChangeEvent,
    ChangeType,
    Metric,
    SeriesKey,
    Service,
    Signal,
)
from sentry.anomaly_detection.correlation.footprint import CallEdge, Footprint, Slice
from sentry.anomaly_detection.inputs import trace_lookup
from sentry.models.project import Project
from sentry.testutils.cases import SnubaTestCase, SpanTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now


class TestAnomalyDetectionTraceLookup(TestCase, SnubaTestCase, SpanTestCase):
    def _insert_error(self, when: datetime, trace: str | None) -> None:
        # Insert directly so the untraced error is guaranteed to have no trace context.
        data: dict[str, object] = {
            "received": when.timestamp(),
            "tags": [["environment", "production"]],
        }
        if trace is not None:
            data["contexts"] = {"trace": {"trace_id": trace, "span_id": uuid4().hex[:16]}}
        self.snuba_insert(
            (
                2,
                "insert",
                {
                    "event_id": uuid4().hex,
                    "primary_hash": "a" * 32,
                    "group_id": self.group.id,
                    "project_id": self.project.id,
                    "message": "error",
                    "platform": "python",
                    "datetime": when.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
                    "data": data,
                },
                {},
            )
        )

    def _transaction(
        self, project: Project, when: datetime, trace: str, name: str, parent: str | None = None
    ) -> dict[str, object]:
        extra: dict[str, object] = {
            "trace_id": trace,
            "is_segment": True,
            "sentry_tags": {"environment": "production", "transaction": name},
        }
        if parent is not None:
            extra["parent_span_id"] = parent
        return self.create_span(extra, project=project, start_ts=when, duration=100)

    def test_error_footprint_samples_traced_errors_within_lookup_projects(self) -> None:
        onset = before_now(minutes=20).replace(second=0, microsecond=0)
        when = onset + timedelta(seconds=15)
        trace, unrelated = uuid4().hex, uuid4().hex
        backend = self.create_project(organization=self.organization)
        outside = self.create_project(organization=self.organization)

        # The traced error is older than the untraced one, so a newest-first
        # sample that admits untraced errors would never reach its trace.
        self._insert_error(when, trace)
        self._insert_error(when + timedelta(seconds=5), None)

        call = self.create_span(
            {
                "trace_id": trace,
                "sentry_tags": {
                    "environment": "production",
                    "op": "http.client",
                    "domain": "backend",
                },
            },
            project=self.project,
            start_ts=when,
            duration=50,
        )
        self.store_spans(
            [
                self._transaction(self.project, when, trace, "GET /checkout"),
                call,
                self._transaction(backend, when, trace, "GET /api", parent=call["span_id"]),
                # Same trace and parent, but its project is outside the lookup.
                self._transaction(outside, when, trace, "GET /outside", parent=call["span_id"]),
                # Same lookup project and window, but outside the sampled trace.
                self._transaction(self.project, when, unrelated, "GET /unrelated"),
            ]
        )

        start = onset.replace(tzinfo=None)
        change = ChangeEvent(
            SeriesKey(self.project.id, "production", Signal.ERRORS, Metric.COUNT),
            ChangeType.SPIKE,
            start,
            2,
            0,
            0.9,
        )
        observation_end = start + timedelta(minutes=4)
        with mock.patch.object(trace_lookup, "_TRACE_SAMPLE", 1):
            lookup = trace_lookup.TraceLookup(self.organization, [self.project, backend])
            footprint = lookup.footprint(change, observation_end)

        assert isinstance(footprint, Footprint)
        assert footprint.traces == [trace]
        assert footprint.window == (start - timedelta(minutes=1), observation_end)
        frontend = Service(self.project.id, "production")
        callee = Service(backend.id, "production")
        assert {
            item: (stats.trace_share, stats.spans) for item, stats in footprint.slices.items()
        } == {
            Slice(frontend, None, ""): (1.0, 1),
            Slice(callee, None, ""): (1.0, 1),
            Slice(frontend, Signal.ENDPOINTS, "GET /checkout"): (1.0, 1),
            Slice(callee, Signal.ENDPOINTS, "GET /api"): (1.0, 1),
            Slice(frontend, Signal.OUTBOUND_HTTP, "backend"): (1.0, 1),
        }
        assert footprint.edges == Counter({CallEdge(frontend, "backend", callee): 1})

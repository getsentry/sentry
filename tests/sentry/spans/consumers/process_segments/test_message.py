import uuid
from hashlib import md5
from unittest import mock

import pytest

from sentry.issues.grouptype import PerformanceStreamedSpansGroupTypeExperimental
from sentry.models.environment import Environment
from sentry.models.release import Release
from sentry.spans.consumers.process_segments.message import _set_exclusive_time, process_segment
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from tests.sentry.spans.consumers.process import build_mock_span


class TestSpansTask(TestCase):
    def setUp(self):
        self.project = self.create_project()

    def generate_basic_spans(self):
        segment_span = build_mock_span(
            project_id=self.project.id,
            is_segment=True,
            sentry_tags={
                "browser.name": "Google Chrome",
                "transaction": "/api/0/organizations/{organization_id_or_slug}/n-plus-one/",
                "transaction.method": "GET",
                "transaction.op": "http.server",
                "user": "id:1",
            },
        )
        child_span = build_mock_span(
            project_id=self.project.id,
            description="mock_test",
            parent_span_id=segment_span["span_id"],
            span_id="940ce942561548b5",
            start_timestamp_ms=1707953018867,
            start_timestamp_precise=1707953018.867,
        )

        return [child_span, segment_span]

    def generate_n_plus_one_spans(self):
        segment_span = build_mock_span(
            project_id=self.project.id,
            is_segment=True,
        )
        child_span = build_mock_span(
            project_id=self.project.id,
            description="OrganizationNPlusOne.get",
            parent_span_id=segment_span["span_id"],
            span_id="940ce942561548b5",
            start_timestamp_ms=1707953018867,
            start_timestamp_precise=1707953018.867,
        )
        cause_span = build_mock_span(
            project_id=self.project.id,
            span_op="db",
            description='SELECT "sentry_project"."id", "sentry_project"."slug", "sentry_project"."name", "sentry_project"."forced_color", "sentry_project"."organization_id", "sentry_project"."public", "sentry_project"."date_added", "sentry_project"."status", "sentry_project"."first_event", "sentry_project"."flags", "sentry_project"."platform" FROM "sentry_project"',
            parent_span_id="940ce942561548b5",
            span_id="a974da4671bc3857",
            start_timestamp_ms=1707953018867,
            start_timestamp_precise=1707953018.867,
        )
        repeating_span_description = 'SELECT "sentry_organization"."id", "sentry_organization"."name", "sentry_organization"."slug", "sentry_organization"."status", "sentry_organization"."date_added", "sentry_organization"."default_role", "sentry_organization"."is_test", "sentry_organization"."flags" FROM "sentry_organization" WHERE "sentry_organization"."id" = %s LIMIT 21'

        def repeating_span():
            return build_mock_span(
                project_id=self.project.id,
                span_op="db",
                description=repeating_span_description,
                parent_span_id="940ce942561548b5",
                span_id=uuid.uuid4().hex[:16],
                start_timestamp_ms=1707953018869,
                start_timestamp_precise=1707953018.869,
            )

        repeating_spans = [repeating_span() for _ in range(7)]
        spans = [segment_span, child_span, cause_span] + repeating_spans

        return spans

    def test_enrich_spans(self):
        spans = self.generate_basic_spans()
        processed_spans = process_segment(spans)

        assert len(processed_spans) == len(spans)
        child_span, segment_span = processed_spans
        child_tags = child_span["sentry_tags"]
        segment_tags = segment_span["sentry_tags"]

        assert child_tags["transaction"] == segment_tags["transaction"]
        assert child_tags["transaction.method"] == segment_tags["transaction.method"]
        assert child_tags["transaction.op"] == segment_tags["transaction.op"]
        assert child_tags["user"] == segment_tags["user"]  # type: ignore[typeddict-item]

    def test_enrich_spans_no_segment(self):
        spans = self.generate_basic_spans()
        for span in spans:
            span["is_segment"] = False
            del span["sentry_tags"]

        processed_spans = process_segment(spans)
        assert len(processed_spans) == len(spans)
        for i, span in enumerate(processed_spans):
            assert span["span_id"] == spans[i]["span_id"]
            assert span["op"]
            assert span["hash"]

    def test_create_models(self):
        spans = self.generate_basic_spans()
        assert process_segment(spans)

        Environment.objects.get(
            organization_id=self.organization.id,
            name="development",
        )

        release = Release.objects.get(
            organization_id=self.organization.id,
            version="backend@24.2.0.dev0+699ce0cd1281cc3c7275d0a474a595375c769ae8",
        )
        assert release.date_added.timestamp() == spans[0]["end_timestamp_precise"]

    @override_options(
        {
            "standalone-spans.detect-performance-problems.enable": True,
            "standalone-spans.send-occurrence-to-platform.enable": True,
        }
    )
    @mock.patch("sentry.issues.ingest.send_issue_occurrence_to_eventstream")
    def test_n_plus_one_issue_detection(self, mock_eventstream):
        spans = self.generate_n_plus_one_spans()
        with mock.patch(
            "sentry.issues.grouptype.PerformanceStreamedSpansGroupTypeExperimental.released"
        ) as mock_released:
            mock_released.return_value = True
            process_segment(spans)

        mock_eventstream.assert_called_once()

        performance_problem = mock_eventstream.call_args[0][1]
        assert performance_problem.fingerprint == [
            md5(
                b"1-GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES-f906d576ffde8f005fd741f7b9c8a35062361e67-1019"
            ).hexdigest()
        ]
        assert performance_problem.type == PerformanceStreamedSpansGroupTypeExperimental

    @override_options(
        {
            "standalone-spans.detect-performance-problems.enable": True,
            "standalone-spans.send-occurrence-to-platform.enable": True,
        }
    )
    @mock.patch("sentry.issues.ingest.send_issue_occurrence_to_eventstream")
    @pytest.mark.xfail(reason="batches without segment spans are not supported yet")
    def test_n_plus_one_issue_detection_without_segment_span(self, mock_eventstream):
        segment_span = build_mock_span(project_id=self.project.id, is_segment=False)
        child_span = build_mock_span(
            project_id=self.project.id,
            description="OrganizationNPlusOne.get",
            is_segment=False,
            parent_span_id="b35b839c02985f33",
            span_id="940ce942561548b5",
            start_timestamp_ms=1707953018867,
            start_timestamp_precise=1707953018.867,
        )
        cause_span = build_mock_span(
            project_id=self.project.id,
            span_op="db",
            description='SELECT "sentry_project"."id", "sentry_project"."slug", "sentry_project"."name", "sentry_project"."forced_color", "sentry_project"."organization_id", "sentry_project"."public", "sentry_project"."date_added", "sentry_project"."status", "sentry_project"."first_event", "sentry_project"."flags", "sentry_project"."platform" FROM "sentry_project"',
            is_segment=False,
            parent_span_id="940ce942561548b5",
            span_id="a974da4671bc3857",
            start_timestamp_ms=1707953018867,
            start_timestamp_precise=1707953018.867,
        )
        repeating_span_description = 'SELECT "sentry_organization"."id", "sentry_organization"."name", "sentry_organization"."slug", "sentry_organization"."status", "sentry_organization"."date_added", "sentry_organization"."default_role", "sentry_organization"."is_test", "sentry_organization"."flags" FROM "sentry_organization" WHERE "sentry_organization"."id" = %s LIMIT 21'

        def repeating_span():
            return build_mock_span(
                project_id=self.project.id,
                span_op="db",
                description=repeating_span_description,
                is_segment=False,
                parent_span_id="940ce942561548b5",
                span_id=uuid.uuid4().hex[:16],
                start_timestamp_ms=1707953018869,
                start_timestamp_precise=1707953018.869,
            )

        repeating_spans = [repeating_span() for _ in range(7)]
        spans = [segment_span, child_span, cause_span] + repeating_spans

        with mock.patch(
            "sentry.issues.grouptype.PerformanceStreamedSpansGroupTypeExperimental.released"
        ) as mock_released:
            mock_released.return_value = True
            process_segment(spans)

        performance_problem = mock_eventstream.call_args[0][1]
        assert performance_problem.fingerprint == [
            md5(
                b"1-GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES-f906d576ffde8f005fd741f7b9c8a35062361e67-1019"
            ).hexdigest()
        ]
        assert performance_problem.type == PerformanceStreamedSpansGroupTypeExperimental


# Tests ported from Relay
class TestExclusiveTime(TestCase):
    def test_childless_spans(self):
        spans = [
            build_mock_span(
                project_id=1,
                is_segment=True,
                start_timestamp_precise=1609455600.0,
                end_timestamp_precise=1609455605.0,
                span_id="aaaaaaaaaaaaaaaa",
            ),
            build_mock_span(
                project_id=1,
                start_timestamp_precise=1609455601.0,
                end_timestamp_precise=1609455604.0,
                span_id="bbbbbbbbbbbbbbbb",
                parent_span_id="aaaaaaaaaaaaaaaa",
            ),
            build_mock_span(
                project_id=1,
                start_timestamp_precise=1609455601.0,
                end_timestamp_precise=1609455603.5,
                span_id="cccccccccccccccc",
                parent_span_id="aaaaaaaaaaaaaaaa",
            ),
            build_mock_span(
                project_id=1,
                start_timestamp_precise=1609455603.0,
                end_timestamp_precise=1609455604.877,
                span_id="dddddddddddddddd",
                parent_span_id="aaaaaaaaaaaaaaaa",
            ),
        ]

        _set_exclusive_time(spans)

        exclusive_times = {span["span_id"]: span["exclusive_time"] for span in spans}
        assert exclusive_times == {
            "aaaaaaaaaaaaaaaa": 1123.0,
            "bbbbbbbbbbbbbbbb": 3000.0,
            "cccccccccccccccc": 2500.0,
            "dddddddddddddddd": 1877.0,
        }

    def test_nested_spans(self):
        spans = [
            build_mock_span(
                project_id=1,
                is_segment=True,
                start_timestamp_precise=1609455600.0,
                end_timestamp_precise=1609455605.0,
                span_id="aaaaaaaaaaaaaaaa",
            ),
            build_mock_span(
                project_id=1,
                start_timestamp_precise=1609455601.0,
                end_timestamp_precise=1609455602.0,
                span_id="bbbbbbbbbbbbbbbb",
                parent_span_id="aaaaaaaaaaaaaaaa",
            ),
            build_mock_span(
                project_id=1,
                start_timestamp_precise=1609455601.2,
                end_timestamp_precise=1609455601.8,
                span_id="cccccccccccccccc",
                parent_span_id="bbbbbbbbbbbbbbbb",
            ),
            build_mock_span(
                project_id=1,
                start_timestamp_precise=1609455601.4,
                end_timestamp_precise=1609455601.6,
                span_id="dddddddddddddddd",
                parent_span_id="cccccccccccccccc",
            ),
        ]

        _set_exclusive_time(spans)

        exclusive_times = {span["span_id"]: span["exclusive_time"] for span in spans}
        assert exclusive_times == {
            "aaaaaaaaaaaaaaaa": 4000.0,
            "bbbbbbbbbbbbbbbb": 400.0,
            "cccccccccccccccc": 400.0,
            "dddddddddddddddd": 200.0,
        }

    def test_overlapping_child_spans(self):
        spans = [
            build_mock_span(
                project_id=1,
                is_segment=True,
                start_timestamp_precise=1609455600.0,
                end_timestamp_precise=1609455605.0,
                span_id="aaaaaaaaaaaaaaaa",
            ),
            build_mock_span(
                project_id=1,
                start_timestamp_precise=1609455601.0,
                end_timestamp_precise=1609455602.0,
                span_id="bbbbbbbbbbbbbbbb",
                parent_span_id="aaaaaaaaaaaaaaaa",
            ),
            build_mock_span(
                project_id=1,
                start_timestamp_precise=1609455601.2,
                end_timestamp_precise=1609455601.6,
                span_id="cccccccccccccccc",
                parent_span_id="bbbbbbbbbbbbbbbb",
            ),
            build_mock_span(
                project_id=1,
                start_timestamp_precise=1609455601.4,
                end_timestamp_precise=1609455601.8,
                span_id="dddddddddddddddd",
                parent_span_id="bbbbbbbbbbbbbbbb",
            ),
        ]

        _set_exclusive_time(spans)

        exclusive_times = {span["span_id"]: span["exclusive_time"] for span in spans}
        assert exclusive_times == {
            "aaaaaaaaaaaaaaaa": 4000.0,
            "bbbbbbbbbbbbbbbb": 400.0,
            "cccccccccccccccc": 400.0,
            "dddddddddddddddd": 400.0,
        }

    def test_child_spans_dont_intersect_parent(self):
        spans = [
            build_mock_span(
                project_id=1,
                is_segment=True,
                start_timestamp_precise=1609455600.0,
                end_timestamp_precise=1609455605.0,
                span_id="aaaaaaaaaaaaaaaa",
            ),
            build_mock_span(
                project_id=1,
                start_timestamp_precise=1609455601.0,
                end_timestamp_precise=1609455602.0,
                span_id="bbbbbbbbbbbbbbbb",
                parent_span_id="aaaaaaaaaaaaaaaa",
            ),
            build_mock_span(
                project_id=1,
                start_timestamp_precise=1609455600.4,
                end_timestamp_precise=1609455600.8,
                span_id="cccccccccccccccc",
                parent_span_id="bbbbbbbbbbbbbbbb",
            ),
            build_mock_span(
                project_id=1,
                start_timestamp_precise=1609455602.2,
                end_timestamp_precise=1609455602.6,
                span_id="dddddddddddddddd",
                parent_span_id="bbbbbbbbbbbbbbbb",
            ),
        ]

        _set_exclusive_time(spans)

        exclusive_times = {span["span_id"]: span["exclusive_time"] for span in spans}
        assert exclusive_times == {
            "aaaaaaaaaaaaaaaa": 4000.0,
            "bbbbbbbbbbbbbbbb": 1000.0,
            "cccccccccccccccc": 400.0,
            "dddddddddddddddd": 400.0,
        }

    def test_child_spans_extend_beyond_parent(self):
        spans = [
            build_mock_span(
                project_id=1,
                is_segment=True,
                start_timestamp_precise=1609455600.0,
                end_timestamp_precise=1609455605.0,
                span_id="aaaaaaaaaaaaaaaa",
            ),
            build_mock_span(
                project_id=1,
                start_timestamp_precise=1609455601.0,
                end_timestamp_precise=1609455602.0,
                span_id="bbbbbbbbbbbbbbbb",
                parent_span_id="aaaaaaaaaaaaaaaa",
            ),
            build_mock_span(
                project_id=1,
                start_timestamp_precise=1609455600.8,
                end_timestamp_precise=1609455601.4,
                span_id="cccccccccccccccc",
                parent_span_id="bbbbbbbbbbbbbbbb",
            ),
            build_mock_span(
                project_id=1,
                start_timestamp_precise=1609455601.6,
                end_timestamp_precise=1609455602.2,
                span_id="dddddddddddddddd",
                parent_span_id="bbbbbbbbbbbbbbbb",
            ),
        ]

        _set_exclusive_time(spans)

        exclusive_times = {span["span_id"]: span["exclusive_time"] for span in spans}
        assert exclusive_times == {
            "aaaaaaaaaaaaaaaa": 4000.0,
            "bbbbbbbbbbbbbbbb": 200.0,
            "cccccccccccccccc": 600.0,
            "dddddddddddddddd": 600.0,
        }

    def test_child_spans_consumes_all_of_parent(self):
        spans = [
            build_mock_span(
                project_id=1,
                is_segment=True,
                start_timestamp_precise=1609455600.0,
                end_timestamp_precise=1609455605.0,
                span_id="aaaaaaaaaaaaaaaa",
            ),
            build_mock_span(
                project_id=1,
                start_timestamp_precise=1609455601.0,
                end_timestamp_precise=1609455602.0,
                span_id="bbbbbbbbbbbbbbbb",
                parent_span_id="aaaaaaaaaaaaaaaa",
            ),
            build_mock_span(
                project_id=1,
                start_timestamp_precise=1609455600.8,
                end_timestamp_precise=1609455601.6,
                span_id="cccccccccccccccc",
                parent_span_id="bbbbbbbbbbbbbbbb",
            ),
            build_mock_span(
                project_id=1,
                start_timestamp_precise=1609455601.4,
                end_timestamp_precise=1609455602.2,
                span_id="dddddddddddddddd",
                parent_span_id="bbbbbbbbbbbbbbbb",
            ),
        ]

        _set_exclusive_time(spans)

        exclusive_times = {span["span_id"]: span["exclusive_time"] for span in spans}
        assert exclusive_times == {
            "aaaaaaaaaaaaaaaa": 4000.0,
            "bbbbbbbbbbbbbbbb": 0.0,
            "cccccccccccccccc": 800.0,
            "dddddddddddddddd": 800.0,
        }

    def test_only_immediate_child_spans_affect_calculation(self):
        spans = [
            build_mock_span(
                project_id=1,
                is_segment=True,
                start_timestamp_precise=1609455600.0,
                end_timestamp_precise=1609455605.0,
                span_id="aaaaaaaaaaaaaaaa",
            ),
            build_mock_span(
                project_id=1,
                start_timestamp_precise=1609455601.0,
                end_timestamp_precise=1609455602.0,
                span_id="bbbbbbbbbbbbbbbb",
                parent_span_id="aaaaaaaaaaaaaaaa",
            ),
            build_mock_span(
                project_id=1,
                start_timestamp_precise=1609455601.6,
                end_timestamp_precise=1609455602.2,
                span_id="cccccccccccccccc",
                parent_span_id="bbbbbbbbbbbbbbbb",
            ),
            build_mock_span(
                project_id=1,
                start_timestamp_precise=1609455601.4,
                end_timestamp_precise=1609455601.8,
                span_id="dddddddddddddddd",
                parent_span_id="cccccccccccccccc",
            ),
        ]

        _set_exclusive_time(spans)

        exclusive_times = {span["span_id"]: span["exclusive_time"] for span in spans}
        assert exclusive_times == {
            "aaaaaaaaaaaaaaaa": 4000.0,
            "bbbbbbbbbbbbbbbb": 600.0,
            "cccccccccccccccc": 400.0,
            "dddddddddddddddd": 400.0,
        }

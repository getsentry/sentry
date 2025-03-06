import uuid
from hashlib import md5
from unittest import mock

import pytest

from sentry.issues.grouptype import PerformanceStreamedSpansGroupTypeExperimental
from sentry.spans.consumers.process_segments.message import process_segment
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from tests.sentry.spans.consumers.process.test_factory import build_mock_span


class TestSpansTask(TestCase):
    def setUp(self):
        self.project = self.create_project()

    def generate_n_plus_one_spans(self):
        segment_span = build_mock_span(project_id=self.project.id)
        child_span = build_mock_span(
            project_id=self.project.id,
            description="OrganizationNPlusOne.get",
            is_segment=False,
            parent_span_id="b35b839c02985f33",
            span_id="940ce942561548b5",
            start_timestamp_ms=1707953018867,
        )
        cause_span = build_mock_span(
            project_id=self.project.id,
            span_op="db",
            description='SELECT "sentry_project"."id", "sentry_project"."slug", "sentry_project"."name", "sentry_project"."forced_color", "sentry_project"."organization_id", "sentry_project"."public", "sentry_project"."date_added", "sentry_project"."status", "sentry_project"."first_event", "sentry_project"."flags", "sentry_project"."platform" FROM "sentry_project"',
            is_segment=False,
            parent_span_id="940ce942561548b5",
            span_id="a974da4671bc3857",
            start_timestamp_ms=1707953018867,
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
            )

        repeating_spans = [repeating_span() for _ in range(7)]
        spans = [segment_span, child_span, cause_span] + repeating_spans

        return spans

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
        )
        cause_span = build_mock_span(
            project_id=self.project.id,
            span_op="db",
            description='SELECT "sentry_project"."id", "sentry_project"."slug", "sentry_project"."name", "sentry_project"."forced_color", "sentry_project"."organization_id", "sentry_project"."public", "sentry_project"."date_added", "sentry_project"."status", "sentry_project"."first_event", "sentry_project"."flags", "sentry_project"."platform" FROM "sentry_project"',
            is_segment=False,
            parent_span_id="940ce942561548b5",
            span_id="a974da4671bc3857",
            start_timestamp_ms=1707953018867,
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

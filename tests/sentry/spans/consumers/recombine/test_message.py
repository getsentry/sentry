import uuid

from sentry.issues.grouptype import PerformanceStreamedSpansGroupTypeExperimental
from sentry.spans.consumers.recombine.message import process_segment
from sentry.testutils.cases import TestCase
from tests.sentry.spans.consumers.process.test_factory import build_mock_span


class TestSpansTask(TestCase):
    def setUp(self):
        self.project = self.create_project()

    def test_n_plus_one_issue_detection(self):
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

        job = process_segment(spans)[0]

        assert (
            job["performance_problems"][0].fingerprint
            == "1-GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES-f906d576ffde8f005fd741f7b9c8a35062361e67-1019"
        )

        assert job["performance_problems"][0].type == PerformanceStreamedSpansGroupTypeExperimental

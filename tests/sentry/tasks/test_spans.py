import uuid
from unittest import mock

from sentry.issues.grouptype import PerformanceStreamedSpansGroupTypeExperimental
from sentry.spans.buffer.redis import RedisSpansBuffer
from sentry.tasks.spans import _process_segment
from sentry.testutils.cases import TestCase
from sentry.utils import json


def build_mock_span(project_id, span_op=None, **kwargs):
    span = {
        "description": "OrganizationNPlusOne",
        "duration_ms": 107,
        "event_id": "61ccae71d70f45bb9b1f2ccb7f7a49ec",
        "exclusive_time_ms": 107.359,
        "is_segment": True,
        "parent_span_id": "b35b839c02985f33",
        "profile_id": "dbae2b82559649a1a34a2878134a007b",
        "project_id": project_id,
        "received": 1707953019.044972,
        "retention_days": 90,
        "segment_id": "a49b42af9fb69da0",
        "sentry_tags": {
            "browser.name": "Google Chrome",
            "environment": "development",
            "op": span_op or "base.dispatch.sleep",
            "release": "backend@24.2.0.dev0+699ce0cd1281cc3c7275d0a474a595375c769ae8",
            "transaction": "/api/0/organizations/{organization_slug}/n-plus-one/",
            "transaction.method": "GET",
            "transaction.op": "http.server",
            "user": "id:1",
        },
        "span_id": "a49b42af9fb69da0",
        "start_timestamp_ms": 1707953018865,
        "trace_id": "94576097f3a64b68b85a59c7d4e3ee2a",
    }

    span.update(**kwargs)
    return json.dumps(span)


class TestSpansTask(TestCase):
    def setUp(self):
        self.project = self.create_project()

    @mock.patch.object(RedisSpansBuffer, "read_segment")
    def test_n_plus_one_issue_detection(self, mock_read_segment):
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

        mock_read_segment.return_value = spans
        job = _process_segment(self.project.id, "a49b42af9fb69da0")[0]

        assert (
            job["performance_problems"][0].fingerprint
            == "1-GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES-f906d576ffde8f005fd741f7b9c8a35062361e67"
        )

        assert job["performance_problems"][0].type == PerformanceStreamedSpansGroupTypeExperimental

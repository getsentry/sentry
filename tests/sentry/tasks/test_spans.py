import uuid
from unittest import mock

import pytest

from sentry.issues.grouptype import PerformanceStreamedSpansGroupTypeExperimental
from sentry.spans.buffer.redis import RedisSpansBuffer, get_segment_key
from sentry.tasks.spans import _process_segment, _process_segments, run_performnance_issue_detection
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all
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

    @mock.patch.object(RedisSpansBuffer, "read_many_segments")
    def test_n_plus_one_issue_detection(self, mock_read_many_segments):
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

        key = get_segment_key(self.project.id, "a49b42af9fb69da0")
        mock_read_many_segments.return_value = [(key, spans)]

        with mock.patch("sentry.tasks.spans._process_segment") as mock_process_segment:
            _process_segments([key])
            mock_process_segment.assert_called_once_with(spans)

        job = _process_segment(spans)[0]
        assert (
            job["performance_problems"][0].fingerprint
            == "1-GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES-f906d576ffde8f005fd741f7b9c8a35062361e67-1019"
        )

        assert job["performance_problems"][0].type == PerformanceStreamedSpansGroupTypeExperimental


@django_db_all
@mock.patch("sentry.tasks.spans.process_segments")
def test_run_performnance_issue_detection_default(mock_process_segments):
    with freeze_time("2000-01-01") as frozen_time:
        buffer = RedisSpansBuffer()
        for i in range(20):
            frozen_time.shift(1)
            buffer.write_span_and_get_last_processed_timestamp("bar", f"span{i}", b"span data")

        frozen_time.shift(120)
        run_performnance_issue_detection()

        assert mock_process_segments.delay.call_count == 0


@override_options(
    {
        "standalone-spans.performance-issue-detection.enable": True,
        "standalone-spans.process-segments.batch-size": 5,
        "standalone-spans.process-segments.max-batches": 2,
        "standalone-spans.process-segments.drain.enable": False,
    }
)
@mock.patch("sentry.tasks.spans.process_segments")
def test_run_performnance_issue_detection_options(mock_process_segments):
    with freeze_time("2000-01-01") as frozen_time:
        buffer = RedisSpansBuffer()
        for i in range(20):
            frozen_time.shift(1)
            buffer.write_span_and_get_last_processed_timestamp("bar", f"span{i}", b"span data")

        frozen_time.shift(120)
        run_performnance_issue_detection()
        mock_process_segments.delay.assert_any_call(
            [
                (946684801.0, "segment:span0:bar:process-segment"),
                (946684802.0, "segment:span1:bar:process-segment"),
                (946684803.0, "segment:span2:bar:process-segment"),
                (946684804.0, "segment:span3:bar:process-segment"),
                (946684805.0, "segment:span4:bar:process-segment"),
            ]
        )
        mock_process_segments.delay.assert_any_call(
            [
                (946684806.0, "segment:span5:bar:process-segment"),
                (946684807.0, "segment:span6:bar:process-segment"),
                (946684808.0, "segment:span7:bar:process-segment"),
                (946684809.0, "segment:span8:bar:process-segment"),
                (946684810.0, "segment:span9:bar:process-segment"),
            ]
        )

        assert mock_process_segments.delay.call_count == 2


@pytest.mark.parametrize(
    ["batch_size", "max_batches", "expected_call_count"],
    [(10, 1, 1), (5, 10, 4)],
)
@mock.patch("sentry.tasks.spans.process_segments")
def test_run_performnance_issue_detection_with_different_buckets(
    mock_process_segments, batch_size, max_batches, expected_call_count
):
    with freeze_time("2000-01-01") as frozen_time:
        buffer = RedisSpansBuffer()
        for i in range(20):
            frozen_time.shift(1)
            buffer.write_span_and_get_last_processed_timestamp("bar", f"span{i}", b"span data")

        frozen_time.shift(120)

        with override_options(
            {
                "standalone-spans.performance-issue-detection.enable": True,
                "standalone-spans.process-segments.batch-size": batch_size,
                "standalone-spans.process-segments.max-batches": max_batches,
                "standalone-spans.process-segments.drain.enable": False,
            }
        ):
            run_performnance_issue_detection()

        assert mock_process_segments.delay.call_count == expected_call_count


@pytest.mark.parametrize(
    ["drain", "time_shift", "expected_call_count"],
    [(True, 1, 0), (True, 10, 0), (False, 1, 0), (False, 10, 2)],
)
@mock.patch("sentry.tasks.spans.process_segments")
def test_run_performnance_issue_detection_drain(
    mock_process_segments, drain, time_shift, expected_call_count
):
    with freeze_time("2000-01-01") as frozen_time:
        buffer = RedisSpansBuffer()
        for i in range(20):
            frozen_time.shift(time_shift)
            buffer.write_span_and_get_last_processed_timestamp("bar", f"span{i}", b"span data")

        frozen_time.shift(100)

        with override_options(
            {
                "standalone-spans.performance-issue-detection.enable": True,
                "standalone-spans.process-segments.batch-size": 5,
                "standalone-spans.process-segments.max-batches": 2,
                "standalone-spans.process-segments.drain.enable": drain,
            }
        ):
            run_performnance_issue_detection()

        assert mock_process_segments.delay.call_count == expected_call_count


@override_options(
    {
        "standalone-spans.performance-issue-detection.enable": True,
        "standalone-spans.process-segments.batch-size": 5,
        "standalone-spans.process-segments.max-batches": 2,
        "standalone-spans.process-segments.drain.enable": False,
    }
)
@mock.patch("sentry.tasks.spans.process_segments")
def test_run_performnance_issue_detection_no_segments(mock_process_segments):
    with freeze_time("2000-01-01") as frozen_time:
        buffer = RedisSpansBuffer()
        for i in range(20):
            frozen_time.shift(1)
            buffer.write_span_and_get_last_processed_timestamp("bar", f"span{i}", b"span data")

        run_performnance_issue_detection()

        assert mock_process_segments.delay.call_count == 0

import uuid
from hashlib import md5
from typing import Any
from unittest import mock

import pytest
from sentry_conventions.attributes import ATTRIBUTE_NAMES

from sentry.issues.grouptype import PerformanceStreamedSpansGroupTypeExperimental
from sentry.models.environment import Environment
from sentry.models.release import Release
from sentry.spans.consumers.process_segments.message import _verify_compatibility, process_segment
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import Feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.issue_detection.experiments import exclude_experimental_detectors
from tests.sentry.spans.consumers.process import build_mock_span


@exclude_experimental_detectors
class TestSpansTask(TestCase):
    def setUp(self) -> None:
        self.project = self.create_project()

    def generate_basic_spans(self):
        segment_span = build_mock_span(
            project_id=self.project.id,
            is_segment=True,
            attributes={
                "sentry.browser.name": {"value": "Google Chrome"},
                "sentry.transaction": {
                    "value": "/api/0/organizations/{organization_id_or_slug}/n-plus-one/"
                },
                "sentry.transaction.method": {"value": "GET"},
                "sentry.transaction.op": {"value": "http.server"},
                "sentry.user": {"value": "id:1"},
            },
        )
        child_span = build_mock_span(
            project_id=self.project.id,
            description="mock_test",
            parent_span_id=segment_span["span_id"],
            span_id="940ce942561548b5",
            start_timestamp_ms=1707953018867,
            start_timestamp=1707953018.867,
        )

        return [child_span, segment_span]

    def generate_n_plus_one_spans(self):
        segment_span = build_mock_span(
            project_id=self.project.id,
            is_segment=True,
            _performance_issues_spans=True,
        )
        child_span = build_mock_span(
            project_id=self.project.id,
            description="OrganizationNPlusOne.get",
            parent_span_id=segment_span["span_id"],
            span_id="940ce942561548b5",
            start_timestamp_ms=1707953018867,
            start_timestamp=1707953018.867,
        )
        cause_span = build_mock_span(
            project_id=self.project.id,
            span_op="db",
            description='SELECT "sentry_project"."id", "sentry_project"."slug", "sentry_project"."name", "sentry_project"."forced_color", "sentry_project"."organization_id", "sentry_project"."public", "sentry_project"."date_added", "sentry_project"."status", "sentry_project"."first_event", "sentry_project"."flags", "sentry_project"."platform" FROM "sentry_project"',
            parent_span_id="940ce942561548b5",
            span_id="a974da4671bc3857",
            start_timestamp_ms=1707953018867,
            start_timestamp=1707953018.867,
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
                start_timestamp=1707953018.869,
            )

        repeating_spans = [repeating_span() for _ in range(7)]
        spans = [segment_span, child_span, cause_span] + repeating_spans

        return spans

    def test_enrich_spans(self) -> None:
        spans = self.generate_basic_spans()
        processed_spans = process_segment(spans)

        assert len(processed_spans) == len(spans)
        child_span, segment_span = processed_spans
        child_attrs = child_span["attributes"] or {}
        segment_data = segment_span["attributes"] or {}

        assert child_attrs["sentry.transaction"] == segment_data["sentry.transaction"]
        assert child_attrs["sentry.transaction.method"] == segment_data["sentry.transaction.method"]
        assert child_attrs["sentry.transaction.op"] == segment_data["sentry.transaction.op"]
        assert child_attrs["sentry.user"] == segment_data["sentry.user"]

    def test_enrich_spans_no_segment(self) -> None:
        spans = self.generate_basic_spans()
        for span in spans:
            span["is_segment"] = False
            del span["attributes"]

        processed_spans = process_segment(spans)
        assert len(processed_spans) == len(spans)
        for i, span in enumerate(processed_spans):
            assert span["span_id"] == spans[i]["span_id"]
            assert span["op"]
            assert span["hash"]

    def test_create_models(self) -> None:
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
        assert release.date_added.timestamp() == spans[0]["end_timestamp"]

    @override_options({"spans.process-segments.detect-performance-problems.enable": True})
    @mock.patch("sentry.issues.ingest.send_issue_occurrence_to_eventstream")
    def test_n_plus_one_issue_detection(self, mock_eventstream: mock.MagicMock) -> None:
        spans = self.generate_n_plus_one_spans()
        with mock.patch(
            "sentry.issues.grouptype.PerformanceStreamedSpansGroupTypeExperimental.released",
            return_value=True,
        ):
            process_segment(spans)

        mock_eventstream.assert_called_once()

        performance_problem = mock_eventstream.call_args[0][1]
        assert performance_problem.fingerprint == [
            md5(
                b"1-GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES-f906d576ffde8f005fd741f7b9c8a35062361e67-1019"
            ).hexdigest()
        ]
        assert performance_problem.type == PerformanceStreamedSpansGroupTypeExperimental

    @override_options({"spans.process-segments.detect-performance-problems.enable": True})
    @mock.patch("sentry.issues.ingest.send_issue_occurrence_to_eventstream")
    @pytest.mark.xfail(reason="batches without segment spans are not supported yet")
    def test_n_plus_one_issue_detection_without_segment_span(
        self, mock_eventstream: mock.MagicMock
    ) -> None:
        segment_span = build_mock_span(project_id=self.project.id, is_segment=False)
        child_span = build_mock_span(
            project_id=self.project.id,
            description="OrganizationNPlusOne.get",
            is_segment=False,
            parent_span_id="b35b839c02985f33",
            span_id="940ce942561548b5",
            start_timestamp_ms=1707953018867,
            start_timestamp=1707953018.867,
        )
        cause_span = build_mock_span(
            project_id=self.project.id,
            span_op="db",
            description='SELECT "sentry_project"."id", "sentry_project"."slug", "sentry_project"."name", "sentry_project"."forced_color", "sentry_project"."organization_id", "sentry_project"."public", "sentry_project"."date_added", "sentry_project"."status", "sentry_project"."first_event", "sentry_project"."flags", "sentry_project"."platform" FROM "sentry_project"',
            is_segment=False,
            parent_span_id="940ce942561548b5",
            span_id="a974da4671bc3857",
            start_timestamp_ms=1707953018867,
            start_timestamp=1707953018.867,
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
                start_timestamp=1707953018.869,
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

    @mock.patch("sentry.spans.consumers.process_segments.message.track_outcome")
    @pytest.mark.skip("temporarily disabled")
    def test_skip_produce_does_not_track_outcomes(self, mock_track_outcome: mock.MagicMock) -> None:
        """Test that outcomes are not tracked when skip_produce=True"""
        spans = self.generate_basic_spans()

        # Process with skip_produce=True
        process_segment(spans, skip_produce=True)

        # Verify track_outcome was not called
        mock_track_outcome.assert_not_called()

        # Process with skip_produce=False (default)
        process_segment(spans, skip_produce=False)

        # Verify track_outcome was called once
        mock_track_outcome.assert_called_once()

    @mock.patch("sentry.spans.consumers.process_segments.message.set_project_flag_and_signal")
    def test_record_signals(self, mock_track):
        span = build_mock_span(
            project_id=self.project.id,
            is_segment=True,
            span_op="http.client",
            attributes={
                "sentry.op": {"value": "http.client"},
                "sentry.category": {"value": "http"},
            },
        )
        spans = process_segment([span])
        assert len(spans) == 1

        signals = [args[0][1] for args in mock_track.call_args_list]
        assert signals == ["has_transactions", "has_insights_http"]

    def test_segment_name_propagation(self):
        child_span, segment_span = self.generate_basic_spans()
        segment_span["name"] = "my segment name"

        processed_spans = process_segment([child_span, segment_span])

        assert len(processed_spans) == 2
        child_span, segment_span = processed_spans
        segment_attributes = segment_span["attributes"] or {}
        assert segment_attributes["sentry.segment.name"] == {
            "type": "string",
            "value": "my segment name",
        }
        child_attributes = child_span["attributes"] or {}
        assert child_attributes["sentry.segment.name"] == {
            "type": "string",
            "value": "my segment name",
        }

    def test_segment_name_propagation_when_name_missing(self):
        child_span, segment_span = self.generate_basic_spans()
        del segment_span["name"]

        processed_spans = process_segment([child_span, segment_span])

        assert len(processed_spans) == 2
        child_span, segment_span = processed_spans
        segment_attributes = segment_span["attributes"] or {}
        assert segment_attributes.get("sentry.segment.name") is None
        child_attributes = child_span["attributes"] or {}
        assert child_attributes.get("sentry.segment.name") is None

    @mock.patch("sentry.spans.consumers.process_segments.message.record_segment_name")
    def test_segment_name_normalization_with_feature(
        self, mock_record_segment_name: mock.MagicMock
    ):
        _, segment_span = self.generate_basic_spans()
        segment_span["name"] = "/foo/2fd4e1c67a2d28fced849ee1bb76e7391b93eb12/user/123/0"

        with self.feature("organizations:normalize_segment_names_in_span_enrichment"):
            processed_spans = process_segment([segment_span])

        assert processed_spans[0]["name"] == "/foo/*/user/*/0"
        mock_record_segment_name.assert_called_once()

    @mock.patch("sentry.spans.consumers.process_segments.message.record_segment_name")
    def test_segment_name_normalization_without_feature(
        self, mock_record_segment_name: mock.MagicMock
    ):
        _, segment_span = self.generate_basic_spans()
        segment_span["name"] = "/foo/2fd4e1c67a2d28fced849ee1bb76e7391b93eb12/user/123/0"

        with Feature({"organizations:normalize_segment_names_in_span_enrichment": False}):
            processed_spans = process_segment([segment_span])

        assert (
            processed_spans[0]["name"] == "/foo/2fd4e1c67a2d28fced849ee1bb76e7391b93eb12/user/123/0"
        )
        mock_record_segment_name.assert_not_called()

    def test_segment_name_normalization_checks_source(self):
        _, segment_span = self.generate_basic_spans()
        segment_span["name"] = "/foo/2fd4e1c67a2d28fced849ee1bb76e7391b93eb12/user/123/0"
        segment_span["attributes"][ATTRIBUTE_NAMES.SENTRY_SPAN_SOURCE] = {
            "type": "string",
            "value": "route",
        }

        with self.feature("organizations:normalize_segment_names_in_span_enrichment"):
            processed_spans = process_segment([segment_span])

        assert (
            processed_spans[0]["name"] == "/foo/2fd4e1c67a2d28fced849ee1bb76e7391b93eb12/user/123/0"
        )


def test_verify_compatibility():
    spans: list[dict[str, Any]] = [
        # regular span:
        {"data": {"foo": 1}},
        # valid compat span:
        {"data": {"foo": 1}, "attributes": {"foo": {"value": 1}}},
        # invalid compat spans:
        {"data": {"foo": 1}, "attributes": {"value": {"foo": "2"}}},
        {"data": {"bar": 1}, "attributes": None},
        {"data": {"baz": 1}, "attributes": {}},
        {"data": {"zap": 1}, "attributes": {"zap": {"no_value": "1"}}},
        {"data": {"abc": 1}, "attributes": {"abc": None}},
    ]
    result = _verify_compatibility(spans)
    assert len(result) == len(spans)
    assert [v is None for v in result] == [True, True, False, False, False, False, False]

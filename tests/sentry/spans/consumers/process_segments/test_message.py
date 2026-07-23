import uuid
from hashlib import md5
from typing import Any
from unittest import mock

import pytest
from django.utils import timezone

from sentry.issues.grouptype import PerformanceNPlusOneGroupType
from sentry.models.environment import Environment
from sentry.models.release import Release
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.models.releases.release_project import ReleaseProject
from sentry.spans.consumers.process_segments import message as message_module
from sentry.spans.consumers.process_segments.message import (
    _bump_release_last_seen,
    _verify_compatibility,
    process_segment,
)
from sentry.spans.consumers.process_segments.shim import build_shim_event_data
from sentry.spans.consumers.process_segments.types import attribute_value
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.issue_detection.experiments import exclude_experimental_detectors
from tests.sentry.spans.consumers.process import build_mock_span


@exclude_experimental_detectors
class TestSpansTask(TestCase):
    def setUp(self) -> None:
        self.project = self.create_project()
        message_module.cache = None

    def tearDown(self) -> None:
        message_module.cache = None

    def generate_basic_spans(self):
        segment_span = build_mock_span(
            project_id=self.project.id,
            is_segment=True,
            attributes={
                "sentry.browser.name": {"value": "Google Chrome"},
                "sentry.segment.name": {
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

        assert child_attrs["sentry.segment.name"] == segment_data["sentry.segment.name"]
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

    def test_build_shim_event_data_supports_legacy_profile_id(self) -> None:
        segment_span = build_mock_span(project_id=self.project.id, is_segment=True)
        segment_span["hash"] = "hashed-segment"

        event = build_shim_event_data(segment_span, [segment_span])

        assert event["contexts"]["profile"] == {
            "profile_id": "dbae2b82559649a1a34a2878134a007b",
            "type": "profile",
        }

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

    def test_create_models_trim_environment_name(self) -> None:
        spans = self.generate_basic_spans()
        spans[1]["attributes"]["sentry.environment"]["value"] = "a" * 100
        assert process_segment(spans)

        # Environment is trimmed
        Environment.objects.get(
            organization_id=self.organization.id,
            name="a" * 64,
        )

    def test_create_models_auto_creation_disabled(self) -> None:
        self.project.update_option("sentry:enable_auto_release_creation", False)
        spans = self.generate_basic_spans()

        with self.feature("organizations:auto-release-creation"):
            assert process_segment(spans)

        Environment.objects.get(organization_id=self.organization.id, name="development")
        assert not Release.objects.filter(organization_id=self.organization.id).exists()

    def test_create_models_auto_creation_disabled_associates_existing_release(self) -> None:
        # A release created out-of-band (e.g. via the CLI) is still associated even
        # when auto-creation is disabled.
        self.project.update_option("sentry:enable_auto_release_creation", False)
        release = Release.objects.create(
            organization_id=self.organization.id,
            version="backend@24.2.0.dev0+699ce0cd1281cc3c7275d0a474a595375c769ae8",
        )
        spans = self.generate_basic_spans()

        with self.feature("organizations:auto-release-creation"):
            assert process_segment(spans)

        assert ReleaseProject.objects.filter(release=release, project=self.project).exists()
        assert ReleaseProjectEnvironment.objects.filter(
            release_id=release.id, project_id=self.project.id
        ).exists()

    def test_create_models_auto_creation_disabled_without_feature_flag(self) -> None:
        self.project.update_option("sentry:enable_auto_release_creation", False)
        spans = self.generate_basic_spans()
        assert process_segment(spans)

        assert Release.objects.filter(organization_id=self.organization.id).exists()

    def test_bump_release_last_seen_auto_creation_disabled(self) -> None:
        self.project.update_option("sentry:enable_auto_release_creation", False)

        with self.feature("organizations:auto-release-creation"):
            _bump_release_last_seen(self.project, "development", "1.0", timezone.now())

        assert not Release.objects.filter(organization_id=self.organization.id).exists()

    @override_options({"spans.process-segments.detect-performance-problems.enable": True})
    @mock.patch("sentry.issues.ingest.send_issue_occurrence_to_eventstream")
    def test_n_plus_one_issue_detection(self, mock_eventstream: mock.MagicMock) -> None:
        spans = self.generate_n_plus_one_spans()
        with mock.patch("sentry.issues.ingest.should_create_group", return_value=True):
            process_segment(spans)

        mock_eventstream.assert_called_once()

        performance_problem = mock_eventstream.call_args[0][1]
        assert performance_problem.fingerprint == [
            md5(
                b"1-GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES-f906d576ffde8f005fd741f7b9c8a35062361e67"
            ).hexdigest()
        ]
        assert performance_problem.type == PerformanceNPlusOneGroupType

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

        with mock.patch("sentry.issues.ingest.should_create_group", return_value=True):
            process_segment(spans)

        performance_problem = mock_eventstream.call_args[0][1]
        assert performance_problem.fingerprint == [
            md5(
                b"1-GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES-f906d576ffde8f005fd741f7b9c8a35062361e67"
            ).hexdigest()
        ]
        assert performance_problem.type == PerformanceNPlusOneGroupType

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
        assert "has_insights_agent_monitoring" not in signals

    @mock.patch("sentry.spans.consumers.process_segments.message.set_project_flag_and_signal")
    def test_record_signals_agents_via_gen_ai_op_name(self, mock_track):
        """Test that spans with gen_ai.operation.name attribute trigger agents insight."""
        span = build_mock_span(
            project_id=self.project.id,
            is_segment=True,
            span_op="http.client",
            attributes={
                "sentry.op": {"value": "http.client"},
                "gen_ai.operation.name": {"value": "chat"},
            },
        )
        spans = process_segment([span])
        assert len(spans) == 1

        signals = [args[0][1] for args in mock_track.call_args_list]
        assert signals == ["has_transactions", "has_insights_agent_monitoring"]

    @mock.patch("sentry.spans.consumers.process_segments.message.metrics.incr")
    def test_gen_ai_conversation_metric(self, mock_incr: mock.MagicMock) -> None:
        """Count once per segment when any span has gen_ai.conversation.id."""
        metric_name = "spans.consumers.process_segments.gen_ai_conversation"

        def conversation_calls() -> int:
            return sum(1 for call in mock_incr.call_args_list if call == mock.call(metric_name))

        child_span, segment_span = self.generate_basic_spans()
        process_segment([child_span, segment_span])
        assert conversation_calls() == 0

        mock_incr.reset_mock()
        child_span, segment_span = self.generate_basic_spans()
        child_span["attributes"]["gen_ai.conversation.id"] = {
            "type": "string",
            "value": "conv-123",
        }
        process_segment([child_span, segment_span])
        assert conversation_calls() == 1

        mock_incr.reset_mock()
        child_span, segment_span = self.generate_basic_spans()
        child_span["attributes"]["gen_ai.conversation.id"] = {
            "type": "string",
            "value": "conv-123",
        }
        segment_span["attributes"]["gen_ai.conversation.id"] = {
            "type": "string",
            "value": "conv-123",
        }
        process_segment([child_span, segment_span])
        assert conversation_calls() == 1

        mock_incr.reset_mock()
        child_span, segment_span = self.generate_basic_spans()
        child_span["attributes"]["gen_ai.conversation.id"] = {
            "type": "string",
            "value": "conv-123",
        }
        process_segment([child_span, segment_span], skip_enrichment=True)
        assert conversation_calls() == 1

    def test_segment_name_propagation(self) -> None:
        child_span, segment_span = self.generate_basic_spans()
        assert (
            attribute_value(segment_span, "sentry.segment.name")
            == "/api/0/organizations/{organization_id_or_slug}/n-plus-one/"
        )
        assert attribute_value(child_span, "sentry.segment.name") is None

        processed_spans = process_segment([child_span, segment_span])

        assert len(processed_spans) == 2
        child_span, segment_span = processed_spans
        segment_attributes = segment_span["attributes"] or {}
        assert segment_attributes["sentry.segment.name"] == {
            "value": "/api/0/organizations/{organization_id_or_slug}/n-plus-one/",
        }
        child_attributes = child_span["attributes"] or {}
        assert child_attributes["sentry.segment.name"] == {
            "value": "/api/0/organizations/{organization_id_or_slug}/n-plus-one/",
        }

    def test_segment_name_propagation_when_name_missing(self) -> None:
        child_span, segment_span = self.generate_basic_spans()
        del segment_span["name"]
        del segment_span["attributes"]["sentry.segment.name"]

        processed_spans = process_segment([child_span, segment_span])

        assert len(processed_spans) == 2
        child_span, segment_span = processed_spans
        segment_attributes = segment_span["attributes"] or {}
        assert segment_attributes.get("sentry.segment.name") is None
        child_attributes = child_span["attributes"] or {}
        assert child_attributes.get("sentry.segment.name") is None


def test_verify_compatibility() -> None:
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


@exclude_experimental_detectors
class TestSkipEnrichmentKillswitch(TestCase):
    def setUp(self) -> None:
        self.project = self.create_project()

    @mock.patch(
        "sentry.spans.consumers.process_segments.message.TreeEnricher.enrich_spans",
        wraps=None,
    )
    def test_skip_enrichment_by_project_id(self, mock_enrich: mock.MagicMock) -> None:
        """Test that enrichment is skipped and spans are still returned when project_id matches killswitch."""
        segment_span = build_mock_span(
            project_id=self.project.id,
            is_segment=True,
        )
        child_span = build_mock_span(
            project_id=self.project.id,
            parent_span_id=segment_span["span_id"],
        )

        with override_options(
            {"spans.process-segments.skip-enrichment-projects": [self.project.id]}
        ):
            processed_spans = process_segment([child_span, segment_span])

        mock_enrich.assert_not_called()
        assert len(processed_spans) == 2

    @mock.patch(
        "sentry.spans.consumers.process_segments.message.TreeEnricher.enrich_spans",
    )
    def test_no_skip_enrichment_for_other_project(self, mock_enrich: mock.MagicMock) -> None:
        """Test that enrichment is not skipped when project_id does not match the option."""
        mock_enrich.return_value = (None, [])
        segment_span = build_mock_span(
            project_id=self.project.id,
            is_segment=True,
        )
        child_span = build_mock_span(
            project_id=self.project.id,
            parent_span_id=segment_span["span_id"],
        )

        with override_options(
            {"spans.process-segments.skip-enrichment-projects": [self.project.id + 1]}
        ):
            process_segment([child_span, segment_span])

        mock_enrich.assert_called_once()

    @mock.patch(
        "sentry.spans.consumers.process_segments.message.TreeEnricher.enrich_spans",
        wraps=None,
    )
    def test_skip_enrichment_flag(self, mock_enrich: mock.MagicMock) -> None:
        """Test that enrichment is skipped when skip_enrichment=True is passed."""
        segment_span = build_mock_span(
            project_id=self.project.id,
            is_segment=True,
        )
        child_span = build_mock_span(
            project_id=self.project.id,
            parent_span_id=segment_span["span_id"],
        )

        processed_spans = process_segment([child_span, segment_span], skip_enrichment=True)

        mock_enrich.assert_not_called()
        assert len(processed_spans) == 2

    @mock.patch(
        "sentry.spans.consumers.process_segments.message.TreeEnricher.enrich_spans",
    )
    def test_no_skip_enrichment_when_flag_is_false(self, mock_enrich: mock.MagicMock) -> None:
        """Test that enrichment runs normally when skip_enrichment=False."""
        mock_enrich.return_value = (None, [])
        segment_span = build_mock_span(
            project_id=self.project.id,
            is_segment=True,
        )
        child_span = build_mock_span(
            project_id=self.project.id,
            parent_span_id=segment_span["span_id"],
        )

        process_segment([child_span, segment_span], skip_enrichment=False)

        mock_enrich.assert_called_once()


@exclude_experimental_detectors
class TestSegmentDropKillswitch(TestCase):
    def setUp(self) -> None:
        self.project = self.create_project()

    def test_drop_segment_by_org_id(self) -> None:
        """Test that segments are dropped when org_id matches killswitch."""
        segment_span = build_mock_span(
            project_id=self.project.id,
            is_segment=True,
        )
        child_span = build_mock_span(
            project_id=self.project.id,
            parent_span_id=segment_span["span_id"],
        )

        with override_options(
            {
                "spans.process-segments.drop-segments": [
                    {"org_id": str(self.project.organization_id)}
                ]
            }
        ):
            processed_spans = process_segment([child_span, segment_span])
            assert len(processed_spans) == 0

    def test_drop_segment_with_skip_enrichment(self) -> None:
        segment_span = build_mock_span(
            project_id=self.project.id,
            is_segment=True,
        )

        with override_options(
            {
                "spans.process-segments.drop-segments": [
                    {"org_id": str(self.project.organization_id)}
                ]
            }
        ):
            assert process_segment([segment_span], skip_enrichment=True) == []


@exclude_experimental_detectors
class TestProcessSegmentCaching(TestCase):
    def setUp(self):
        self.project = self.create_project()
        self.base_ts = 1707953018.972  # Default `end_timestamp` generated by `build_mock_span`
        message_module.cache = None

    def tearDown(self):
        message_module.cache = None

    @mock.patch("sentry.spans.consumers.process_segments.message._bump_release_last_seen")
    @mock.patch("sentry.spans.consumers.process_segments.message._create_models")
    def test_first_segment_calls_create_models(self, mock_create, mock_bump):
        segment = build_mock_span(project_id=self.project.id, is_segment=True)
        process_segment([segment])

        mock_create.assert_called_once()
        mock_bump.assert_not_called()

    @mock.patch("sentry.spans.consumers.process_segments.message._bump_release_last_seen")
    @mock.patch("sentry.spans.consumers.process_segments.message._create_models")
    def test_duplicate_segment_is_noop(self, mock_create, mock_bump):
        segment = build_mock_span(project_id=self.project.id, is_segment=True)
        process_segment([segment])
        mock_create.reset_mock()

        process_segment([segment])

        mock_create.assert_not_called()
        mock_bump.assert_not_called()

    @mock.patch("sentry.spans.consumers.process_segments.message._bump_release_last_seen")
    @mock.patch("sentry.spans.consumers.process_segments.message._create_models")
    def test_segment_within_interval_is_noop(self, mock_create, mock_bump):
        segment = build_mock_span(project_id=self.project.id, is_segment=True)
        process_segment([segment])
        mock_create.reset_mock()

        later = build_mock_span(
            project_id=self.project.id,
            is_segment=True,
            end_timestamp=self.base_ts + 59,
        )
        process_segment([later])

        mock_create.assert_not_called()
        mock_bump.assert_not_called()

    @mock.patch("sentry.spans.consumers.process_segments.message._bump_release_last_seen")
    @mock.patch("sentry.spans.consumers.process_segments.message._create_models")
    def test_segment_exceeding_interval_calls_bump(self, mock_create, mock_bump):
        segment = build_mock_span(project_id=self.project.id, is_segment=True)
        process_segment([segment])
        mock_create.reset_mock()

        later = build_mock_span(
            project_id=self.project.id,
            is_segment=True,
            end_timestamp=self.base_ts + 61,
        )
        process_segment([later])

        mock_create.assert_not_called()
        mock_bump.assert_called_once()

    @mock.patch("sentry.spans.consumers.process_segments.message._bump_release_last_seen")
    @mock.patch("sentry.spans.consumers.process_segments.message._create_models")
    def test_bump_advances_cached_timestamp(self, mock_create, mock_bump):
        segment = build_mock_span(project_id=self.project.id, is_segment=True)
        process_segment([segment])
        mock_create.reset_mock()

        # Trigger a bump at T+61.
        bump_ts = self.base_ts + 61
        process_segment(
            [build_mock_span(project_id=self.project.id, is_segment=True, end_timestamp=bump_ts)]
        )
        mock_bump.reset_mock()

        # T+90 is only 29s after the bump — should be noop.
        process_segment(
            [
                build_mock_span(
                    project_id=self.project.id, is_segment=True, end_timestamp=self.base_ts + 90
                )
            ]
        )
        mock_create.assert_not_called()
        mock_bump.assert_not_called()

        # T+122 is 61s after the bump — should trigger another bump.
        process_segment(
            [
                build_mock_span(
                    project_id=self.project.id, is_segment=True, end_timestamp=bump_ts + 61
                )
            ]
        )
        mock_bump.assert_called_once()

    @mock.patch("sentry.spans.consumers.process_segments.message._bump_release_last_seen")
    @mock.patch("sentry.spans.consumers.process_segments.message._create_models")
    def test_different_release_triggers_create_models(self, mock_create, mock_bump):
        segment = build_mock_span(project_id=self.project.id, is_segment=True)
        process_segment([segment])
        mock_create.reset_mock()

        segment = build_mock_span(
            project_id=self.project.id,
            is_segment=True,
            attributes={"sentry.release": {"value": "v2.0.0", "type": "string"}},
        )
        process_segment([segment])

        mock_create.assert_called_once()
        mock_bump.assert_not_called()

    @mock.patch("sentry.spans.consumers.process_segments.message._bump_release_last_seen")
    @mock.patch("sentry.spans.consumers.process_segments.message._create_models")
    def test_different_environment_triggers_create_models(self, mock_create, mock_bump):
        segment = build_mock_span(project_id=self.project.id, is_segment=True)
        process_segment([segment])
        mock_create.reset_mock()

        segment = build_mock_span(
            project_id=self.project.id,
            is_segment=True,
            attributes={"sentry.environment": {"value": "production", "type": "string"}},
        )
        process_segment([segment])

        mock_create.assert_called_once()
        mock_bump.assert_not_called()

    @mock.patch("sentry.spans.consumers.process_segments.message._bump_release_last_seen")
    @mock.patch("sentry.spans.consumers.process_segments.message._create_models")
    def test_out_of_order_old_event_is_noop(self, mock_create, mock_bump):
        later = build_mock_span(
            project_id=self.project.id,
            is_segment=True,
            end_timestamp=self.base_ts + 200,
        )
        process_segment([later])
        mock_create.reset_mock()

        earlier = build_mock_span(project_id=self.project.id, is_segment=True)
        process_segment([earlier])

        mock_create.assert_not_called()
        mock_bump.assert_not_called()

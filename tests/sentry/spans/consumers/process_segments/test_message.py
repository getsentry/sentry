import uuid
from hashlib import md5
from typing import Any
from unittest import mock

import pytest
from django.utils import timezone

from sentry.issue_detection.detectors.n_plus_one_db_span_detector import NPlusOneDBSpanDetector
from sentry.issue_detection.detectors.span_first.run_detectors import run_span_first_detectors
from sentry.issue_detection.detectors.span_first.span_first_utils import (
    SPAN_FIRST_DETECTORS_ENABLEMENT_OPTION,
    SpanFirstDetectorsRolloutController,
)
from sentry.issue_detection.performance_detection import (
    DETECTOR_CLASSES,
    detect_performance_problems,
    get_detection_settings,
)
from sentry.issues.grouptype import PerformanceNPlusOneGroupType
from sentry.models.environment import Environment
from sentry.models.project import Project
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
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.issue_detection.experiments import exclude_experimental_detectors
from sentry.testutils.pytest.fixtures import django_db_all
from tests.sentry.spans.consumers.process import build_mock_span

DETECTORS_ENABLED_OPTION = "spans.process-segments.detect-performance-problems.detectors-enabled"
PERFORMANCE_ISSUES_SPANS_ORG_FEATURE_FLAG = "organizations:performance-issues-spans"
DISCARD_TRANSACTIONS_PROJECT_FEATURE_FLAG = "projects:discard-transaction"


def generate_n_plus_one_spans(
    project: Project,
    *,
    has_performance_issues_spans_relay_flag: bool = False,
    event_id: str | None = None,
):
    """
    Build a set of spans containing an N+1 problem.

    `has_performance_issues_spans_relay_flag` controls Relay's `_performance_issues_spans` marker.
    Relay omits the marker entirely rather than serializing it as `False`, so it's only set here
    if the parameter is True.
    """
    segment_span_kwargs: dict[str, Any] = {}
    if has_performance_issues_spans_relay_flag:
        segment_span_kwargs["_performance_issues_spans"] = True
    if event_id is not None:
        segment_span_kwargs["event_id"] = event_id

    segment_span = build_mock_span(
        project_id=project.id,
        is_segment=True,
        **segment_span_kwargs,
    )
    child_span = build_mock_span(
        project_id=project.id,
        description="OrganizationNPlusOne.get",
        parent_span_id=segment_span["span_id"],
        span_id="940ce942561548b5",
        start_timestamp_ms=1707953018867,
        start_timestamp=1707953018.867,
    )
    cause_span = build_mock_span(
        project_id=project.id,
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
            project_id=project.id,
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

    @override_options({DETECTORS_ENABLED_OPTION: ["*"]})
    @with_feature(PERFORMANCE_ISSUES_SPANS_ORG_FEATURE_FLAG)
    @mock.patch("sentry.issues.ingest.send_issue_occurrence_to_eventstream")
    def test_n_plus_one_issue_detection(self, mock_eventstream: mock.MagicMock) -> None:
        spans = generate_n_plus_one_spans(
            self.project,
            # Force segment to create an occurrence so we can examine it
            has_performance_issues_spans_relay_flag=True,
        )

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

    @override_options({DETECTORS_ENABLED_OPTION: ["*"]})
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

    def test_detector_settings_only_fetched_once(self) -> None:
        spans = self.generate_basic_spans()
        detection_settings = get_detection_settings(self.project)

        with (
            override_options(
                {DETECTORS_ENABLED_OPTION: ["*"], SPAN_FIRST_DETECTORS_ENABLEMENT_OPTION: True}
            ),
            mock.patch.object(
                SpanFirstDetectorsRolloutController, "should_check_experiment", return_value=True
            ),
            mock.patch(
                "sentry.spans.consumers.process_segments.message.get_detection_settings",
                return_value=detection_settings,
            ) as mock_get_detection_settings,
            mock.patch(
                "sentry.spans.consumers.process_segments.message.detect_performance_problems",
                wraps=detect_performance_problems,
            ) as legacy_detectors_spy,
            mock.patch(
                "sentry.spans.consumers.process_segments.message.run_span_first_detectors",
                wraps=run_span_first_detectors,
            ) as span_first_detectors_spy,
        ):
            process_segment(spans)

            assert mock_get_detection_settings.call_count == 1
            mock_get_detection_settings.assert_called_with(self.project)

            legacy_settings = legacy_detectors_spy.call_args.kwargs["detection_settings"]
            span_first_settings = span_first_detectors_spy.call_args.args[3]

            assert legacy_settings is detection_settings
            assert span_first_settings is detection_settings

    def test_no_detectors_enabled(self) -> None:
        """
        An empty option value is the killswitch for all segment-based issue detection, so nothing
        downstream of it should run -- not even the settings fetch.
        """
        spans = generate_n_plus_one_spans(self.project)

        with (
            override_options({DETECTORS_ENABLED_OPTION: []}),
            mock.patch(
                "sentry.spans.consumers.process_segments.message.get_detection_settings",
            ) as get_detection_settings_mock,
            mock.patch(
                "sentry.spans.consumers.process_segments.message.detect_performance_problems",
            ) as legacy_detectors_mock,
        ):
            process_segment(spans)

            get_detection_settings_mock.assert_not_called()
            legacy_detectors_mock.assert_not_called()

    def test_blanket_detector_enablement(self) -> None:
        spans = generate_n_plus_one_spans(self.project)

        with (
            override_options({DETECTORS_ENABLED_OPTION: ["*"]}),
            mock.patch(
                "sentry.spans.consumers.process_segments.message.detect_performance_problems",
                wraps=detect_performance_problems,
            ) as legacy_detectors_spy,
        ):
            process_segment(spans)

            assert legacy_detectors_spy.call_args.kwargs["detector_classes"] == DETECTOR_CLASSES

    def test_selective_detector_enablement(self) -> None:
        spans = generate_n_plus_one_spans(self.project)

        with (
            override_options({DETECTORS_ENABLED_OPTION: ["n_plus_one_db"]}),
            mock.patch(
                "sentry.spans.consumers.process_segments.message.detect_performance_problems",
                wraps=detect_performance_problems,
            ) as legacy_detectors_spy,
        ):
            process_segment(spans)

            assert legacy_detectors_spy.call_args.kwargs["detector_classes"] == [
                NPlusOneDBSpanDetector
            ]

    def test_invalid_detector_types_ignored_in_enablement_option(self) -> None:
        """
        A detector type we don't recognize is almost certainly a typo in the option value. Skipping
        it lets the valid entries keep working, but it needs to be noisy about it, because
        otherwise a typo is indistinguishable from having deliberately switched that detector off.
        """
        spans = generate_n_plus_one_spans(self.project)

        with (
            override_options({DETECTORS_ENABLED_OPTION: ["n_plus_one_db", "dogs_are_great"]}),
            mock.patch(
                "sentry.spans.consumers.process_segments.message.detect_performance_problems",
                wraps=detect_performance_problems,
            ) as legacy_detectors_spy,
            mock.patch(
                "sentry.spans.consumers.process_segments.message.logger.warning"
            ) as logger_warning_mock,
        ):
            process_segment(spans)

            # The bogus entry is dropped, but the valid one still runs
            assert legacy_detectors_spy.call_args.kwargs["detector_classes"] == [
                NPlusOneDBSpanDetector
            ]
            logger_warning_mock.assert_called_once_with(
                "issue_detection.span_processor.invalid_enablement_option",
                extra={"option_value": ["n_plus_one_db", "dogs_are_great"]},
            )

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
    def test_record_signals_vitals_from_top_level_is_segment(self, mock_track):
        span = build_mock_span(
            project_id=self.project.id,
            is_segment=True,
            span_op="pageload",
            attributes={
                "sentry.op": {"value": "pageload"},
            },
        )
        assert "sentry.is_segment" not in (span.get("attributes") or {})

        spans = process_segment([span])
        assert len(spans) == 1
        assert "sentry.is_segment" not in (spans[0].get("attributes") or {})

        signals = [args[0][1] for args in mock_track.call_args_list]
        assert "has_insights_vitals" in signals

    @mock.patch("sentry.spans.consumers.process_segments.message.set_project_flag_and_signal")
    def test_record_signals_does_not_set_screen_load_from_navigation_segment(self, mock_track):
        span = build_mock_span(
            project_id=self.project.id,
            is_segment=True,
            span_op="navigation",
            attributes={
                "sentry.op": {"value": "navigation"},
            },
        )

        spans = process_segment([span])
        assert len(spans) == 1

        signals = [args[0][1] for args in mock_track.call_args_list]
        assert "has_insights_screen_load" not in signals

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


@django_db_all
@pytest.mark.parametrize(
    [
        "incoming_data_is_transaction",
        "discard_transactions_feature_flag",
        "performance_issues_spans_relay_flag",
        "performance_issues_spans_feature_flag",
        "create_occurrence_calls_expected",
    ],
    [
        # Data received as standalone spans, feature flag on -> segment creates occurrence
        (False, True, True, True, 1),
        (False, True, False, True, 1),
        (False, False, True, True, 1),
        (False, False, False, True, 1),
        # Transaction discarded, feature flag on -> segment creates occurrence
        (True, True, True, True, 1),
        (True, True, False, True, 1),
        # Transaction kept, relay flag set, feature flag on -> segment creates occurrence
        (True, False, True, True, 1),
        # Transaction kept, relay flag not set -> no segment-based occurrence
        (True, False, False, True, 0),
        # Feature flag off -> no segment-based occurrence regardless of other values
        (True, True, True, False, 0),
        (True, True, False, False, 0),
        (True, False, True, False, 0),
        (True, False, False, False, 0),
        (False, True, True, False, 0),
        (False, True, False, False, 0),
        (False, False, True, False, 0),
        (False, False, False, False, 0),
    ],
)
def test_issue_detector_occurrence_creation(
    incoming_data_is_transaction: bool,
    discard_transactions_feature_flag: bool,
    performance_issues_spans_relay_flag: bool,
    performance_issues_spans_feature_flag: bool,
    create_occurrence_calls_expected: int,
    default_project: Project,
) -> None:
    # Segments only have an event id if it's copied over from a transaction
    event_id = uuid.uuid4().hex if incoming_data_is_transaction else None

    spans = generate_n_plus_one_spans(
        default_project,
        has_performance_issues_spans_relay_flag=performance_issues_spans_relay_flag,
        event_id=event_id,
    )

    with (
        with_feature(
            {
                PERFORMANCE_ISSUES_SPANS_ORG_FEATURE_FLAG: performance_issues_spans_feature_flag,
                DISCARD_TRANSACTIONS_PROJECT_FEATURE_FLAG: discard_transactions_feature_flag,
            }
        ),
        override_options({DETECTORS_ENABLED_OPTION: ["*"]}),
        mock.patch(
            "sentry.spans.consumers.process_segments.message.produce_occurrence_to_kafka"
        ) as mock_produce_occurrence,
    ):
        process_segment(spans)
        assert mock_produce_occurrence.call_count == create_occurrence_calls_expected

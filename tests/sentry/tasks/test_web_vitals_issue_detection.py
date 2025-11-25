from contextlib import contextmanager
from unittest.mock import patch

import pytest

from sentry.issues.grouptype import WebVitalsGroup
from sentry.issues.ingest import hash_fingerprint
from sentry.models.grouphash import GroupHash
from sentry.tasks.web_vitals_issue_detection import run_web_vitals_issue_detection
from sentry.testutils.cases import SnubaTestCase, SpanTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.task_runner import TaskRunner


class WebVitalsIssueDetectionDataTest(TestCase, SnubaTestCase, SpanTestCase):
    def setUp(self):
        super().setUp()
        self.ten_mins_ago = before_now(minutes=10)

    @contextmanager
    def mock_seer_ack(self):
        with (
            patch(
                "sentry.tasks.web_vitals_issue_detection.get_seer_org_acknowledgement"
            ) as mock_ack,
        ):
            mock_ack.return_value = True
            yield {"mock_ack": mock_ack}

    @contextmanager
    def mock_code_mapping(self):
        with (
            patch(
                "sentry.tasks.web_vitals_issue_detection.get_autofix_repos_from_project_code_mappings"
            ) as mock_repos,
        ):
            mock_repos.return_value = [
                {
                    "provider": "integrations:github",
                    "owner": "test-owner",
                    "name": "test-repo",
                }
            ]
            yield {"mock_repos": mock_repos}

    @patch("sentry.tasks.web_vitals_issue_detection.detect_web_vitals_issues_for_project.delay")
    def test_run_detection_dispatches_sub_tasks_when_enabled(self, mock_delay):
        project = self.create_project()

        with (
            self.mock_seer_ack(),
            self.mock_code_mapping(),
            self.options(
                {
                    "issue-detection.web-vitals-detection.enabled": True,
                    "issue-detection.web-vitals-detection.projects-allowlist": [project.id],
                }
            ),
            self.feature("organizations:gen-ai-features"),
        ):
            run_web_vitals_issue_detection()

        assert mock_delay.called
        assert mock_delay.call_args[0][0] == project.id

    @patch("sentry.tasks.web_vitals_issue_detection.detect_web_vitals_issues_for_project.delay")
    def test_run_detection_skips_when_seer_not_acknowledged(self, mock_delay):
        project = self.create_project()

        with (
            self.mock_code_mapping(),
            self.options(
                {
                    "issue-detection.web-vitals-detection.enabled": True,
                    "issue-detection.web-vitals-detection.projects-allowlist": [project.id],
                }
            ),
            self.feature("organizations:gen-ai-features"),
        ):
            run_web_vitals_issue_detection()

        assert not mock_delay.called

    @patch("sentry.tasks.web_vitals_issue_detection.detect_web_vitals_issues_for_project.delay")
    def test_run_detection_skips_when_no_github_code_mappings(self, mock_delay):
        project = self.create_project()

        with (
            self.mock_seer_ack(),
            self.options(
                {
                    "issue-detection.web-vitals-detection.enabled": True,
                    "issue-detection.web-vitals-detection.projects-allowlist": [project.id],
                }
            ),
            self.feature("organizations:gen-ai-features"),
        ):
            run_web_vitals_issue_detection()

        assert not mock_delay.called

    @patch("sentry.tasks.web_vitals_issue_detection.detect_web_vitals_issues_for_project.delay")
    def test_run_detection_skips_when_not_allowlisted(self, mock_delay):
        with (
            self.mock_seer_ack(),
            self.mock_code_mapping(),
            self.options(
                {
                    "issue-detection.web-vitals-detection.enabled": True,
                    "issue-detection.web-vitals-detection.projects-allowlist": [],
                }
            ),
            self.feature("organizations:gen-ai-features"),
        ):
            run_web_vitals_issue_detection()

        assert not mock_delay.called

    @pytest.mark.snuba
    @patch("sentry.web_vitals.issue_platform_adapter.produce_occurrence_to_kafka")
    def test_run_detection_produces_occurrences(self, mock_produce_occurrence_to_kafka):
        project = self.create_project()

        spans = []
        # web vital issue detection requires at least 10 samples per vital to create an issue
        for _ in range(10):
            spans.extend(
                [
                    self.create_span(
                        project=project,
                        extra_data={
                            "sentry_tags": {
                                "op": "ui.webvitals.lcp",
                                "transaction": "/home",
                            },
                        },
                        start_ts=self.ten_mins_ago,
                        duration=100,
                        measurements={
                            "score.ratio.lcp": {"value": 0.5},
                            "lcp": {"value": 3500},
                        },
                    ),
                    self.create_span(
                        project=project,
                        extra_data={
                            "sentry_tags": {
                                "op": "ui.webvitals.cls",
                                "transaction": "/home",
                            },
                        },
                        start_ts=self.ten_mins_ago,
                        duration=100,
                        measurements={
                            "cls": {"value": 0.15},
                        },
                    ),
                    self.create_span(
                        project=project,
                        extra_data={
                            "description": "pageload",
                            "sentry_tags": {
                                "op": "ui.interaction.click",
                                "transaction": "/home",
                            },
                        },
                        start_ts=self.ten_mins_ago,
                        duration=100,
                        measurements={
                            "score.ratio.inp": {"value": 0.85},
                            "inp": {"value": 200},
                        },
                    ),
                    self.create_span(
                        project=project,
                        extra_data={
                            "description": "pageload",
                            "sentry_tags": {
                                "op": "pageload",
                                "transaction": "/home",
                            },
                        },
                        start_ts=self.ten_mins_ago,
                        duration=3000,
                        measurements={
                            "score.ratio.fcp": {"value": 0.8},
                            "score.ratio.ttfb": {"value": 0.9},
                            "fcp": {"value": 1800},
                            "ttfb": {"value": 200},
                        },
                    ),
                ]
            )

        self.store_spans(spans, is_eap=True)

        with (
            self.mock_seer_ack(),
            self.mock_code_mapping(),
            self.options(
                {
                    "issue-detection.web-vitals-detection.enabled": True,
                    "issue-detection.web-vitals-detection.projects-allowlist": [project.id],
                }
            ),
            self.feature("organizations:gen-ai-features"),
            TaskRunner(),
        ):
            run_web_vitals_issue_detection()

            assert mock_produce_occurrence_to_kafka.call_count == 2
            call_args_list = mock_produce_occurrence_to_kafka.call_args_list

            # Common attributes
            for call in call_args_list:
                call_kwargs = call.kwargs
                occurrence = call_kwargs["occurrence"]
                event_data = call_kwargs["event_data"]
                assert occurrence.type == WebVitalsGroup
                assert occurrence.project_id == project.id
                assert occurrence.evidence_data == {"transaction": "/home"}
                assert len(occurrence.evidence_display) == 1
                assert occurrence.evidence_display[0].name == "Transaction"
                assert occurrence.evidence_display[0].value == "/home"
                assert occurrence.level == "info"
                assert occurrence.culprit == "/home"
                assert event_data["project_id"] == project.id
                assert event_data["tags"]["transaction"] == "/home"
                assert "trace" in event_data["contexts"]

            lcp_call = call_args_list[0]
            lcp_occurrence = lcp_call.kwargs["occurrence"]
            assert lcp_occurrence.fingerprint == ["d94185e6d794589212c74476702515734b703f86"]
            assert lcp_occurrence.issue_title == "The page /home was slow to load and render"
            assert (
                lcp_occurrence.subtitle == "/home has an LCP score of 0.5 and an FCP score of 0.8"
            )
            lcp_event_data = lcp_call.kwargs["event_data"]
            assert lcp_event_data["tags"]["lcp_score"] == "0.5"
            assert lcp_event_data["tags"]["lcp"] == "3500.0"

            inp_call = call_args_list[1]
            inp_occurrence = inp_call.kwargs["occurrence"]
            assert inp_occurrence.fingerprint == ["d8b421cb6e5476121654d1383e80f4515a7f58b9"]
            assert (
                inp_occurrence.issue_title == "The page /home responded slowly to user interactions"
            )
            assert inp_occurrence.subtitle == "/home has an INP score of 0.85"
            inp_event_data = inp_call.kwargs["event_data"]
            assert inp_event_data["tags"]["inp_score"] == "0.85"
            assert inp_event_data["tags"]["inp"] == "200.0"

    @pytest.mark.snuba
    @patch("sentry.web_vitals.issue_platform_adapter.produce_occurrence_to_kafka")
    def test_run_detection_groups_rendering_vitals(self, mock_produce_occurrence_to_kafka):
        project = self.create_project()

        spans = []
        # web vital issue detection requires at least 10 samples per vital to create an issue
        for _ in range(10):
            spans.extend(
                [
                    self.create_span(
                        project=project,
                        extra_data={
                            "sentry_tags": {
                                "op": "ui.webvitals.lcp",
                                "transaction": "/home",
                            },
                        },
                        start_ts=self.ten_mins_ago,
                        duration=100,
                        measurements={
                            "score.ratio.lcp": {"value": 0.5},
                            "lcp": {"value": 3500},
                        },
                    ),
                    self.create_span(
                        project=project,
                        extra_data={
                            "description": "pageload",
                            "sentry_tags": {
                                "op": "pageload",
                                "transaction": "/home",
                            },
                        },
                        start_ts=self.ten_mins_ago,
                        duration=3000,
                        measurements={
                            "score.ratio.fcp": {"value": 0.8},
                            "score.ratio.ttfb": {"value": 0.6},
                            "fcp": {"value": 1800},
                            "ttfb": {"value": 2000},
                        },
                    ),
                    self.create_span(
                        project=project,
                        extra_data={
                            "sentry_tags": {
                                "op": "ui.webvitals.lcp",
                                "transaction": "/settings",
                            },
                        },
                        start_ts=self.ten_mins_ago,
                        duration=100,
                        measurements={
                            "score.ratio.lcp": {"value": 0.5},
                            "lcp": {"value": 3500},
                        },
                    ),
                ]
            )

        self.store_spans(spans, is_eap=True)

        with (
            self.mock_seer_ack(),
            self.mock_code_mapping(),
            self.options(
                {
                    "issue-detection.web-vitals-detection.enabled": True,
                    "issue-detection.web-vitals-detection.projects-allowlist": [project.id],
                }
            ),
            self.feature("organizations:gen-ai-features"),
            TaskRunner(),
        ):
            run_web_vitals_issue_detection()

            assert mock_produce_occurrence_to_kafka.call_count == 2
            call_args_list = mock_produce_occurrence_to_kafka.call_args_list

            # Common attributes
            for call in call_args_list:
                call_kwargs = call.kwargs
                occurrence = call_kwargs["occurrence"]
                event_data = call_kwargs["event_data"]
                assert occurrence.type == WebVitalsGroup
                assert occurrence.project_id == project.id
                assert len(occurrence.evidence_display) == 1
                assert occurrence.evidence_display[0].name == "Transaction"
                assert occurrence.level == "info"
                assert event_data["project_id"] == project.id
                assert "trace" in event_data["contexts"]

            assert call_args_list[0].kwargs["event_data"]["tags"]["transaction"] == "/home"
            assert call_args_list[1].kwargs["event_data"]["tags"]["transaction"] == "/settings"

            lcp_call = call_args_list[0]
            lcp_occurrence = lcp_call.kwargs["occurrence"]
            assert lcp_occurrence.fingerprint == ["d94185e6d794589212c74476702515734b703f86"]
            assert lcp_occurrence.issue_title == "The page /home was slow to load and render"
            assert (
                lcp_occurrence.subtitle
                == "/home has an LCP score of 0.5, an FCP score of 0.8 and a TTFB score of 0.6"
            )
            lcp_event_data = lcp_call.kwargs["event_data"]
            assert lcp_event_data["tags"]["lcp_score"] == "0.5"
            assert lcp_event_data["tags"]["fcp_score"] == "0.8"
            assert lcp_event_data["tags"]["ttfb_score"] == "0.6"
            assert lcp_event_data["tags"]["lcp"] == "3500.0"
            assert lcp_event_data["tags"]["fcp"] == "1800.0"
            assert lcp_event_data["tags"]["ttfb"] == "2000.0"

    @pytest.mark.snuba
    @patch("sentry.web_vitals.issue_platform_adapter.produce_occurrence_to_kafka")
    def test_run_detection_does_not_produce_occurrences_for_existing_issues(
        self, mock_produce_occurrence_to_kafka
    ):
        project = self.create_project()

        spans = [
            self.create_span(
                project=project,
                extra_data={
                    "sentry_tags": {
                        "op": "ui.webvitals.lcp",
                        "transaction": "/home",
                    },
                },
                start_ts=self.ten_mins_ago,
                duration=100,
                measurements={
                    "score.ratio.lcp": {"value": 0.5},
                    "lcp": {"value": 3500},
                },
            )
            for _ in range(10)
        ]  # web vital issue detection requires at least 10 samples to create an issue

        self.store_spans(spans, is_eap=True)

        # Create an existing issue group so that the web vital issue detection does not produce a new occurrence
        group = self.create_group(project=project)
        rendering_fingerprint = "d94185e6d794589212c74476702515734b703f86"
        hashed_fingerprint = hash_fingerprint([rendering_fingerprint])
        GroupHash.objects.create(
            project=project,
            group=group,
            hash=hashed_fingerprint[0],
        )

        with (
            self.mock_seer_ack(),
            self.mock_code_mapping(),
            self.options(
                {
                    "issue-detection.web-vitals-detection.enabled": True,
                    "issue-detection.web-vitals-detection.projects-allowlist": [project.id],
                }
            ),
            self.feature("organizations:gen-ai-features"),
            TaskRunner(),
        ):
            run_web_vitals_issue_detection()

            # Should not produce any occurrences because the LCP issue already exists
            assert mock_produce_occurrence_to_kafka.call_count == 0

    @pytest.mark.snuba
    @patch("sentry.web_vitals.issue_platform_adapter.produce_occurrence_to_kafka")
    def test_run_detection_does_not_create_issue_on_insufficient_samples(
        self, mock_produce_occurrence_to_kafka
    ):
        project = self.create_project()

        spans = [
            self.create_span(
                project=project,
                extra_data={
                    "sentry_tags": {
                        "op": "ui.webvitals.lcp",
                        "transaction": "/home",
                    },
                },
                start_ts=self.ten_mins_ago,
                duration=100,
                measurements={
                    "score.ratio.lcp": {"value": 0.5},
                    "lcp": {"value": 3500},
                },
            )
            for _ in range(9)
        ]

        self.store_spans(spans, is_eap=True)

        with (
            self.mock_seer_ack(),
            self.mock_code_mapping(),
            self.options(
                {
                    "issue-detection.web-vitals-detection.enabled": True,
                    "issue-detection.web-vitals-detection.projects-allowlist": [project.id],
                }
            ),
            self.feature("organizations:gen-ai-features"),
            TaskRunner(),
        ):
            run_web_vitals_issue_detection()

            assert mock_produce_occurrence_to_kafka.call_count == 0

    @pytest.mark.snuba
    @patch("sentry.web_vitals.issue_platform_adapter.produce_occurrence_to_kafka")
    def test_run_detection_selects_trace_closest_to_p75_web_vital_value(
        self, mock_produce_occurrence_to_kafka
    ):
        project = self.create_project()

        spans = [
            self.create_span(
                project=project,
                extra_data={
                    "sentry_tags": {
                        "op": "ui.webvitals.lcp",
                        "transaction": "/home",
                    },
                },
                start_ts=self.ten_mins_ago,
                duration=100,
                measurements={
                    "score.ratio.lcp": {"value": 0.1},
                    "lcp": {"value": 100},
                },
            )
            for _ in range(7)
        ]

        p75_span = self.create_span(
            project=project,
            extra_data={
                "sentry_tags": {
                    "op": "ui.webvitals.lcp",
                    "transaction": "/home",
                },
            },
            start_ts=self.ten_mins_ago,
            duration=100,
            measurements={
                "score.ratio.lcp": {"value": 0.5},
                "lcp": {"value": 2000},
            },
        )
        spans.append(p75_span)

        spans.extend(
            [
                self.create_span(
                    project=project,
                    extra_data={
                        "sentry_tags": {
                            "op": "ui.webvitals.lcp",
                            "transaction": "/home",
                        },
                    },
                    start_ts=self.ten_mins_ago,
                    duration=100,
                    measurements={
                        "score.ratio.lcp": {"value": 0.2},
                        "lcp": {"value": 3500},
                    },
                )
                for _ in range(2)
            ]
        )

        self.store_spans(spans, is_eap=True)

        with (
            self.mock_seer_ack(),
            self.mock_code_mapping(),
            self.options(
                {
                    "issue-detection.web-vitals-detection.enabled": True,
                    "issue-detection.web-vitals-detection.projects-allowlist": [project.id],
                }
            ),
            self.feature("organizations:gen-ai-features"),
            TaskRunner(),
        ):
            run_web_vitals_issue_detection()

            assert mock_produce_occurrence_to_kafka.call_count == 1
            call_args_list = mock_produce_occurrence_to_kafka.call_args_list
            assert call_args_list[0].kwargs["event_data"]["tags"]["lcp"] == "2000.0"
            assert (
                call_args_list[0].kwargs["event_data"]["contexts"]["trace"]["trace_id"]
                == p75_span["trace_id"]
            )

    @pytest.mark.snuba
    @patch("sentry.web_vitals.issue_platform_adapter.produce_occurrence_to_kafka")
    def test_run_detection_selects_trace_from_worst_score(self, mock_produce_occurrence_to_kafka):
        project = self.create_project()

        spans = [
            self.create_span(
                project=project,
                extra_data={
                    "sentry_tags": {
                        "op": "ui.webvitals.lcp",
                        "transaction": "/home",
                    },
                },
                start_ts=self.ten_mins_ago,
                duration=100,
                measurements={
                    "score.ratio.lcp": {"value": 0.1},
                    "lcp": {"value": 100},
                },
            )
            for _ in range(7)
        ]

        p75_span = self.create_span(
            project=project,
            extra_data={
                "sentry_tags": {
                    "op": "ui.webvitals.lcp",
                    "transaction": "/home",
                },
            },
            start_ts=self.ten_mins_ago,
            duration=100,
            measurements={
                "score.ratio.lcp": {"value": 0.5},
                "lcp": {"value": 2000},
            },
        )
        spans.append(p75_span)

        spans.extend(
            [
                self.create_span(
                    project=project,
                    extra_data={
                        "sentry_tags": {
                            "op": "ui.webvitals.lcp",
                            "transaction": "/home",
                        },
                    },
                    start_ts=self.ten_mins_ago,
                    duration=100,
                    measurements={
                        "score.ratio.lcp": {"value": 0.2},
                        "lcp": {"value": 3500},
                    },
                )
                for _ in range(2)
            ]
        )

        for _ in range(10):
            spans.extend(
                [
                    self.create_span(
                        project=project,
                        extra_data={
                            "description": "pageload",
                            "sentry_tags": {
                                "op": "pageload",
                                "transaction": "/home",
                            },
                        },
                        start_ts=self.ten_mins_ago,
                        duration=3000,
                        measurements={
                            "score.ratio.fcp": {"value": 0.8},
                            "score.ratio.ttfb": {"value": 0.6},
                            "fcp": {"value": 1800},
                            "ttfb": {"value": 2000},
                        },
                    ),
                ]
            )

        self.store_spans(spans, is_eap=True)

        with (
            self.mock_seer_ack(),
            self.mock_code_mapping(),
            self.options(
                {
                    "issue-detection.web-vitals-detection.enabled": True,
                    "issue-detection.web-vitals-detection.projects-allowlist": [project.id],
                }
            ),
            self.feature("organizations:gen-ai-features"),
            TaskRunner(),
        ):
            run_web_vitals_issue_detection()

            assert mock_produce_occurrence_to_kafka.call_count == 1
            call_args_list = mock_produce_occurrence_to_kafka.call_args_list
            assert call_args_list[0].kwargs["event_data"]["tags"]["lcp"] == "2000.0"
            assert call_args_list[0].kwargs["event_data"]["tags"]["fcp"] == "1800.0"
            assert call_args_list[0].kwargs["event_data"]["tags"]["ttfb"] == "2000.0"
            assert (
                call_args_list[0].kwargs["event_data"]["contexts"]["trace"]["trace_id"]
                == p75_span["trace_id"]
            )

    @patch("sentry.tasks.web_vitals_issue_detection.detect_web_vitals_issues_for_project.delay")
    @patch("sentry.tasks.web_vitals_issue_detection.get_merged_settings")
    def test_run_detection_does_not_run_for_project_when_user_has_disabled(
        self, mock_get_merged_settings, mock_detect_web_vitals_issues_for_project
    ):
        mock_get_merged_settings.return_value = {
            "web_vitals_detection_enabled": False,
        }
        project = self.create_project()

        with (
            self.mock_seer_ack(),
            self.mock_code_mapping(),
            self.options(
                {
                    "issue-detection.web-vitals-detection.enabled": True,
                    "issue-detection.web-vitals-detection.projects-allowlist": [project.id],
                }
            ),
            self.feature("organizations:gen-ai-features"),
            TaskRunner(),
        ):
            run_web_vitals_issue_detection()

            assert not mock_detect_web_vitals_issues_for_project.called

from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from sentry.constants import DataCategory
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.exceptions import NoSeerQuotaException
from sentry.seer.autofix.feature.dispatch import AutofixFeatureArgs, trigger_autofix_feature
from sentry.seer.autofix.feature.models import (
    FEATURE_ID,
    LEGACY_FEATURE_ID,
    SINGLE_RUN_FEATURE_ID,
    CodeChangesStepArgs,
    PrIterationStepArgs,
    RCAStepArgs,
    SolutionStepArgs,
)
from sentry.seer.autofix.on_completion_hook import AutofixOnCompletionHook
from sentry.seer.autofix.steps import AutofixStep
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.models import SeerPermissionError
from sentry.testutils.cases import TestCase
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
class TestTriggerAutofixFeature(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project)

    def test_continues_feature_run(self) -> None:
        fake_run = self.create_seer_run(organization=self.organization, seer_run_state_id=123)
        self.create_seer_agent_run(
            run=fake_run,
            source=LEGACY_FEATURE_ID,
            group=self.group,
            project=self.group.project,
        )

        with (
            patch(
                "sentry.seer.autofix.feature.dispatch.SeerAgentClient", autospec=True
            ) as MockClient,
            patch(
                "sentry.seer.autofix.feature.dispatch.get_proxy_headers",
                return_value={"X-Viewer-Context": "signed-viewer-context"},
            ) as mock_get_proxy_headers,
            patch("sentry.seer.autofix.feature.dispatch.quotas") as mock_quotas,
        ):
            mock_quotas.backend.check_seer_quota.return_value = True
            client = MockClient.return_value
            client.continue_feature_run.return_value = fake_run

            run = trigger_autofix_feature(
                self.group,
                AutofixFeatureArgs(
                    referrer=AutofixReferrer.AGENTIC_TRIAGE,
                    step=AutofixStep.ROOT_CAUSE,
                    existing_run_id=123,
                    insert_index=4,
                    user_context="an upstream triage summary",
                    stopping_point=AutofixStoppingPoint.OPEN_PR,
                    step_args=RCAStepArgs(
                        intelligence_level="high",
                        reasoning_effort="low",
                        repo_pins={
                            "owner/repo": {
                                "sha": "abc123",
                                "branch": "main",
                                "base_sha": "abc123",
                                "base_branch": "main",
                            }
                        },
                    ),
                ),
            )

        assert run is fake_run

        # Client scoped to the issue's org/project/group.
        client_kwargs = MockClient.call_args.kwargs
        assert client_kwargs["organization"] == self.group.organization
        assert client_kwargs["project"] == self.group.project
        assert client_kwargs["group"] == self.group
        assert client_kwargs["enable_bash_mode"] is True

        # A rerun uses the existing mirror rather than creating another one.
        run_kwargs = client.continue_feature_run.call_args.kwargs
        assert run_kwargs["existing_agent_run"].run == fake_run
        assert run_kwargs["existing_agent_run"].source == LEGACY_FEATURE_ID
        assert "flush" not in run_kwargs
        payload = run_kwargs["payload"]
        assert payload["group_id"] == self.group.id
        assert payload["project_id"] == self.group.project_id
        assert payload["step"] == AutofixStep.ROOT_CAUSE
        assert payload["existing_run_id"] == 123
        assert payload["insert_index"] == 4
        assert payload["short_id"] == (self.group.qualified_short_id or str(self.group.id))
        assert payload["title"] == self.group.title
        assert payload["user_context"] == "an upstream triage summary"
        assert payload["stopping_point"] == AutofixStoppingPoint.OPEN_PR.value
        assert "repo_pins" not in payload
        assert "tweaks" not in payload
        assert payload["step_args"] == {
            "intelligence_level": "high",
            "reasoning_effort": "low",
            "repo_pins": {
                "owner/repo": {
                    "sha": "abc123",
                    "branch": "main",
                    "base_sha": "abc123",
                    "base_branch": "main",
                }
            },
        }
        # Seer persists this hook on the Explorer run so later PR iteration
        # completions continue through the Autofix completion flow.
        assert payload["on_completion_hook"] == {
            "module_path": AutofixOnCompletionHook.get_module_path(),
            "call_on_failure": True,
        }
        assert run_kwargs["referrer"] == AutofixReferrer.AGENTIC_TRIAGE.value
        assert run_kwargs["proxy_headers"] == {"X-Viewer-Context": "signed-viewer-context"}
        mock_get_proxy_headers.assert_called_once_with()

        client.start_feature_run.assert_not_called()
        mock_quotas.backend.check_seer_quota.assert_not_called()
        mock_quotas.backend.record_seer_run.assert_not_called()

    def test_refuses_run_from_another_project(self) -> None:
        other_project = self.create_project(organization=self.organization)
        other_group = self.create_group(project=other_project)
        foreign_run = self.create_seer_run(organization=self.organization, seer_run_state_id=123)
        self.create_seer_agent_run(
            run=foreign_run,
            source=LEGACY_FEATURE_ID,
            group=other_group,
            project=other_project,
        )

        with (
            patch(
                "sentry.seer.autofix.feature.dispatch.SeerAgentClient", autospec=True
            ) as MockClient,
            patch("sentry.seer.autofix.feature.dispatch.quotas") as mock_quotas,
        ):
            mock_quotas.backend.check_seer_quota.return_value = True

            with pytest.raises(SeerPermissionError, match="Unknown run id for group"):
                trigger_autofix_feature(
                    self.group,
                    AutofixFeatureArgs(
                        referrer=AutofixReferrer.AGENTIC_TRIAGE,
                        step=AutofixStep.SOLUTION,
                        existing_run_id=123,
                        user_context="Find a solution",
                        step_args=SolutionStepArgs(),
                    ),
                )

        MockClient.return_value.continue_feature_run.assert_not_called()
        MockClient.return_value.start_feature_run.assert_not_called()

    def test_refuses_run_without_project(self) -> None:
        unbound_run = self.create_seer_run(organization=self.organization, seer_run_state_id=123)
        self.create_seer_agent_run(
            run=unbound_run,
            source=LEGACY_FEATURE_ID,
            group=self.group,
        )

        with (
            patch(
                "sentry.seer.autofix.feature.dispatch.SeerAgentClient", autospec=True
            ) as MockClient,
            pytest.raises(SeerPermissionError, match="Unknown run id for group"),
        ):
            trigger_autofix_feature(
                self.group,
                AutofixFeatureArgs(
                    referrer=AutofixReferrer.AGENTIC_TRIAGE,
                    step=AutofixStep.SOLUTION,
                    existing_run_id=123,
                    user_context="Find a solution",
                    step_args=SolutionStepArgs(),
                ),
            )

        MockClient.return_value.continue_feature_run.assert_not_called()

    def test_starts_feature_run_and_records_quota(self) -> None:
        fake_run = self.create_seer_run(organization=self.organization, type="feature_run")

        with (
            patch("sentry.seer.autofix.feature.dispatch.SeerAgentClient") as mock_client_cls,
            patch("sentry.seer.autofix.feature.dispatch.quotas") as mock_quotas,
        ):
            mock_quotas.backend.check_seer_quota.return_value = True
            mock_client_cls.return_value.start_feature_run.return_value = fake_run

            run = trigger_autofix_feature(
                self.group,
                AutofixFeatureArgs(
                    referrer=AutofixReferrer.AGENTIC_TRIAGE,
                    step=AutofixStep.ROOT_CAUSE,
                    step_args=RCAStepArgs(),
                    stopping_point=AutofixStoppingPoint.OPEN_PR,
                ),
            )

        assert run is fake_run
        mock_quotas.backend.check_seer_quota.assert_called_once_with(
            org_id=self.organization.id,
            data_category=DataCategory.SEER_AUTOFIX,
        )
        mock_quotas.backend.record_seer_run.assert_called_once_with(
            self.organization.id,
            self.project.id,
            DataCategory.SEER_AUTOFIX,
        )
        mock_client_cls.return_value.continue_feature_run.assert_not_called()
        start_kwargs = mock_client_cls.return_value.start_feature_run.call_args.kwargs
        assert start_kwargs["title"] == (
            f"Autofix RCA — {self.group.qualified_short_id or self.group.id}"
        )
        assert start_kwargs["flush"] is True
        assert start_kwargs["extras"] == {
            "referrer": AutofixReferrer.AGENTIC_TRIAGE.value,
            "stopping_point": AutofixStoppingPoint.OPEN_PR.value,
        }

    def test_raises_when_out_of_budget(self) -> None:
        with (
            patch("sentry.seer.autofix.feature.dispatch.SeerAgentClient") as MockClient,
            patch("sentry.seer.autofix.feature.dispatch.quotas") as mock_quotas,
        ):
            mock_quotas.backend.check_seer_quota.return_value = False

            with pytest.raises(NoSeerQuotaException):
                trigger_autofix_feature(
                    self.group,
                    AutofixFeatureArgs(
                        referrer=AutofixReferrer.AGENTIC_TRIAGE,
                        step=AutofixStep.ROOT_CAUSE,
                        step_args=RCAStepArgs(),
                    ),
                )

        MockClient.return_value.start_feature_run.assert_not_called()
        mock_quotas.backend.record_seer_run.assert_not_called()

    def test_free_cohort_skips_quota_check_and_usage_recording(self) -> None:
        fake_run = self.create_seer_run(organization=self.organization, type="feature_run")

        with (
            patch("sentry.seer.autofix.feature.dispatch.SeerAgentClient") as MockClient,
            patch("sentry.seer.autofix.feature.dispatch.quotas") as mock_quotas,
            patch("sentry.seer.autofix.feature.dispatch.is_free_cohort_org", return_value=True),
        ):
            MockClient.return_value.start_feature_run.return_value = fake_run

            run = trigger_autofix_feature(
                self.group,
                AutofixFeatureArgs(
                    referrer=AutofixReferrer.AGENTIC_TRIAGE,
                    step=AutofixStep.ROOT_CAUSE,
                    step_args=RCAStepArgs(),
                    allow_free_cohort=True,
                ),
            )

        assert run is fake_run
        mock_quotas.backend.check_seer_quota.assert_not_called()
        mock_quotas.backend.record_seer_run.assert_not_called()

    def test_allows_async_dispatch(self) -> None:
        fake_run = self.create_seer_run(organization=self.organization, type="feature_run")

        with (
            patch("sentry.seer.autofix.feature.dispatch.SeerAgentClient") as mock_client_cls,
            patch("sentry.seer.autofix.feature.dispatch.quotas") as mock_quotas,
        ):
            mock_quotas.backend.check_seer_quota.return_value = True
            mock_client_cls.return_value.start_feature_run.return_value = fake_run

            trigger_autofix_feature(
                self.group,
                AutofixFeatureArgs(
                    referrer=AutofixReferrer.AGENTIC_TRIAGE,
                    step=AutofixStep.ROOT_CAUSE,
                    step_args=RCAStepArgs(),
                    flush=False,
                ),
            )

        assert mock_client_cls.return_value.start_feature_run.call_args.kwargs["flush"] is False

    def test_forwards_run_options_to_client(self) -> None:
        fake_run = self.create_seer_run(organization=self.organization, type="feature_run")
        user = self.create_user()

        with (
            patch("sentry.seer.autofix.feature.dispatch.SeerAgentClient") as mock_client_cls,
            patch("sentry.seer.autofix.feature.dispatch.quotas") as mock_quotas,
        ):
            mock_quotas.backend.check_seer_quota.return_value = True
            mock_client_cls.return_value.start_feature_run.return_value = fake_run

            trigger_autofix_feature(
                self.group,
                AutofixFeatureArgs(
                    referrer=AutofixReferrer.AGENTIC_TRIAGE,
                    step=AutofixStep.ROOT_CAUSE,
                    step_args=RCAStepArgs(),
                    user=user,
                ),
            )

        client_kwargs = mock_client_cls.call_args.kwargs
        assert client_kwargs["user"] == user
        assert client_kwargs["enable_bash_mode"] is True
        assert client_kwargs["enable_coding"] is False

    def test_code_changes_enables_coding(self) -> None:
        fake_run = self.create_seer_run(organization=self.organization, type="feature_run")

        with (
            patch("sentry.seer.autofix.feature.dispatch.SeerAgentClient") as mock_client_cls,
            patch("sentry.seer.autofix.feature.dispatch.quotas") as mock_quotas,
        ):
            mock_quotas.backend.check_seer_quota.return_value = True
            mock_client_cls.return_value.start_feature_run.return_value = fake_run

            trigger_autofix_feature(
                self.group,
                AutofixFeatureArgs(
                    referrer=AutofixReferrer.UNKNOWN,
                    step=AutofixStep.CODE_CHANGES,
                    step_args=CodeChangesStepArgs(),
                ),
            )

        client_kwargs = mock_client_cls.call_args.kwargs
        assert client_kwargs["enable_coding"] is True
        agent_run_options = mock_client_cls.return_value.start_feature_run.call_args.kwargs[
            "agent_run_options"
        ]
        assert agent_run_options["enable_coding"] is True
        assert agent_run_options["enable_pr_context_tools"] is False

    def test_pr_iteration_enables_coding_and_sends_its_step_args(self) -> None:
        fake_run = self.create_seer_run(organization=self.organization, seer_run_state_id=123)
        self.create_seer_agent_run(
            run=fake_run,
            source=LEGACY_FEATURE_ID,
            group=self.group,
            project=self.group.project,
        )

        with (
            patch("sentry.seer.autofix.feature.dispatch.SeerAgentClient") as mock_client_cls,
            patch("sentry.seer.autofix.feature.dispatch.quotas"),
        ):
            mock_client_cls.return_value.continue_feature_run.return_value = fake_run

            trigger_autofix_feature(
                self.group,
                AutofixFeatureArgs(
                    referrer=AutofixReferrer.GITHUB_PR_COMMENT,
                    step=AutofixStep.PR_ITERATION,
                    existing_run_id=123,
                    step_args=PrIterationStepArgs(
                        iteration_index=2,
                        iteration_id=41,
                        feedback="[]",
                        pr_urls={"owner/repo": "https://example.com/pull/7"},
                    ),
                ),
            )

        assert mock_client_cls.call_args.kwargs["enable_coding"] is True
        continue_kwargs = mock_client_cls.return_value.continue_feature_run.call_args.kwargs
        assert continue_kwargs["agent_run_options"]["enable_coding"] is True
        assert continue_kwargs["agent_run_options"]["enable_pr_context_tools"] is True
        assert continue_kwargs["payload"]["step_args"] == {
            "iteration_index": 2,
            "iteration_id": 41,
            "feedback": "[]",
            "commit_author": None,
            "pr_urls": {"owner/repo": "https://example.com/pull/7"},
        }

    def test_code_changes_rejected_when_coding_disabled(self) -> None:
        self.organization.update_option("sentry:enable_seer_coding", False)

        with pytest.raises(
            SeerPermissionError, match="Seer coding is not enabled for this organization"
        ):
            trigger_autofix_feature(
                self.group,
                AutofixFeatureArgs(
                    referrer=AutofixReferrer.UNKNOWN,
                    step=AutofixStep.CODE_CHANGES,
                    step_args=CodeChangesStepArgs(),
                    existing_run_id=123,
                ),
            )


@django_db_all
class TestSingleRunStart(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project)

    def _start(self, **kwargs: Any) -> MagicMock:
        args = {
            "referrer": AutofixReferrer.AGENTIC_TRIAGE,
            "step": AutofixStep.ROOT_CAUSE,
            "step_args": RCAStepArgs(),
            **kwargs,
        }
        fake_run = self.create_seer_run(organization=self.organization, type="feature_run")
        with (
            patch("sentry.seer.autofix.feature.dispatch.SeerAgentClient") as mock_client_cls,
            patch("sentry.seer.autofix.feature.dispatch.quotas") as mock_quotas,
            patch("sentry.seer.autofix.feature.dispatch.require_autofix_run_for_group"),
        ):
            mock_quotas.backend.check_seer_quota.return_value = True
            mock_client_cls.return_value.start_feature_run.return_value = fake_run
            mock_client_cls.return_value.continue_feature_run.return_value = fake_run
            trigger_autofix_feature(self.group, AutofixFeatureArgs(**args))
        return mock_client_cls

    def _started_feature_id(self, mock_client_cls: MagicMock) -> str:
        return mock_client_cls.return_value.start_feature_run.call_args.kwargs["feature_id"]

    def _set_handoff(self) -> None:
        self.project.update_option("sentry:seer_automation_handoff_point", "root_cause")
        self.project.update_option(
            "sentry:seer_automation_handoff_target", "cursor_background_agent"
        )
        self.project.update_option("sentry:seer_automation_handoff_integration_id", 456)

    def test_flagged_org_starts_single_run(self) -> None:
        with self.feature("organizations:autofix-single-run"):
            mock_client_cls = self._start()

        assert self._started_feature_id(mock_client_cls) == SINGLE_RUN_FEATURE_ID
        payload = mock_client_cls.return_value.start_feature_run.call_args.kwargs["payload"]
        assert payload["group_id"] == self.group.id
        assert "step" not in payload

    def test_unflagged_org_starts_steps(self) -> None:
        mock_client_cls = self._start()

        assert self._started_feature_id(mock_client_cls) == FEATURE_ID

    def test_caller_can_ask_for_single_run(self) -> None:
        mock_client_cls = self._start(single_run=True)

        assert self._started_feature_id(mock_client_cls) == SINGLE_RUN_FEATURE_ID

    def test_handoff_project_never_single_run(self) -> None:
        self._set_handoff()
        with self.feature("organizations:autofix-single-run"):
            mock_client_cls = self._start(single_run=True)

        assert self._started_feature_id(mock_client_cls) == FEATURE_ID

    def test_retry_never_single_run(self) -> None:
        with self.feature("organizations:autofix-single-run"):
            mock_client_cls = self._start(single_run=True, existing_run_id=5)

        mock_client_cls.return_value.start_feature_run.assert_not_called()
        mock_client_cls.return_value.continue_feature_run.assert_called_once()

    def test_single_run_stopping_point_sets_coding(self) -> None:
        cases = [
            (None, "code_changes", True, True),
            (None, "root_cause", True, False),
            (AutofixStoppingPoint.ROOT_CAUSE, "open_pr", True, False),
            (AutofixStoppingPoint.SOLUTION, "open_pr", True, False),
            (AutofixStoppingPoint.OPEN_PR, "root_cause", True, True),
            (AutofixStoppingPoint.OPEN_PR, "open_pr", False, False),
        ]
        for caller_stopping_point, project_stopping_point, org_coding, expected in cases:
            with self.subTest(caller=caller_stopping_point, project=project_stopping_point):
                self.project.update_option(
                    "sentry:seer_automated_run_stopping_point", project_stopping_point
                )
                self.organization.update_option("sentry:enable_seer_coding", org_coding)

                mock_client_cls = self._start(single_run=True, stopping_point=caller_stopping_point)

                assert mock_client_cls.call_args.kwargs["enable_coding"] is expected
                start_kwargs = mock_client_cls.return_value.start_feature_run.call_args.kwargs
                assert start_kwargs["agent_run_options"]["enable_coding"] is expected
